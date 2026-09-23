/**
 * SPEC — Extras & spear-carriers (§4.8 of the lazy-dm-lens research report;
 * Sly Flourish step 6, scoped to the disposable case the Quick NPC Generator
 * doesn't target)
 * =============================================================================
 * Files under test: services/ai/dmCoach.ts (`generateExtras`),
 * services/aiService.ts (the facade), services/ai/mockService.ts (the mock).
 *
 * WHAT THIS FUNCTION IS
 * ---------------------
 * A schema call (not freeform text, unlike GM Intrusion / Callback) asking
 * for `count` throwaway background characters — a name and ONE vivid
 * one-line detail each, explicitly NOT a backstory or a motivation. Lighter
 * weight than `realmWeaver.generateNpc`: nothing here produces a full `NPC`
 * record, and nothing is persisted until a component calls
 * `campaignService.createNpc` on one line at a time.
 *
 * THE CONTRACT, IN PLAIN SENTENCES
 * --------------------------------
 * 1. **One schema call, not freeform text.** `{ extras: [{ name, detail }] }`.
 * 2. **The instructions ask for exactly `count` extras**, explicitly rule out
 *    backstories/motivations, and ask for ONE vivid detail per line.
 * 3. **The requested count is clamped to a sane range** (at least 1, at most
 *    8) rather than trusting a caller-supplied count verbatim, and a
 *    non-finite count falls back to a reasonable default.
 * 4. **Model output is defensively normalized** — a draft missing a name or a
 *    detail is dropped, and the returned list never exceeds the cap, the
 *    same defensive posture every schema-backed generator in this file
 *    applies before a component ever sees the array.
 * 5. **Runs at the standard tier by default and the lite tier on request.**
 * 6. **The facade owns the mock switch**, following `generateRollableTable`'s
 *    established facade shape: `(count, campaignContext?, useLiteModel?, isMockMode?)`.
 * 7. **The mock is usable, not decorative** — resolves a well-formed, sized
 *    roster of distinct name + detail pairs after the standard mock delay.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/ai/core', () => ({
  generateWithSchema: vi.fn(async () => ({ extras: [{ name: 'Bram Kettle', detail: 'Talks with his hands full.' }] })),
  generateText: vi.fn(async () => 'unused'),
  generateChatCompletion: vi.fn(async () => 'ok'),
}));

import * as core from '../../services/ai/core';
import * as dmCoach from '../../services/ai/dmCoach';
import * as aiService from '../../services/aiService';
import * as mockService from '../../services/ai/mockService';

const sentPrompt = (call = 0) => String(vi.mocked(core.generateWithSchema).mock.calls[call][0]);
const sentSchema = (call = 0) => vi.mocked(core.generateWithSchema).mock.calls[call][1] as {
  properties?: { extras?: { items?: { properties?: Record<string, unknown>; required?: string[] } } };
};
const sentInstructions = (call = 0) => String(vi.mocked(core.generateWithSchema).mock.calls[call][2]);
const sentTier = (call = 0) => vi.mocked(core.generateWithSchema).mock.calls[call][4];
const sentContext = (call = 0) => vi.mocked(core.generateWithSchema).mock.calls[call][5];

beforeEach(() => {
  vi.mocked(core.generateWithSchema).mockClear();
  vi.mocked(core.generateWithSchema).mockResolvedValue({
    extras: [
      { name: 'Bram Kettle', detail: 'Talks with his hands full.' },
      { name: 'Sela Voss', detail: 'A scar through one eyebrow.' },
    ],
  });
  vi.mocked(core.generateText).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- 1 & 2. the schema and the instructions --------------------------------

describe('one schema call asking for throwaway extras', () => {
  it('sends the extras schema shape', async () => {
    await dmCoach.generateExtras(5);
    const schema = sentSchema();
    expect(schema.properties?.extras?.items?.required).toEqual(['name', 'detail']);
    expect(Object.keys(schema.properties?.extras?.items?.properties ?? {}).sort()).toEqual(['detail', 'name']);
  });

  it('asks for the requested count and rules out backstory/motivation', async () => {
    await dmCoach.generateExtras(4);
    const instructions = sentInstructions().toLowerCase();
    expect(instructions).toContain('4');
    expect(instructions).toContain('one vivid one-line detail');
    expect(instructions).toContain('not major characters');
    expect(instructions).toContain('backstories');
  });

  it('makes exactly one schema call and no freeform call', async () => {
    await dmCoach.generateExtras(5);
    expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
    expect(core.generateText).not.toHaveBeenCalled();
  });
});

// --- 3. count clamping -------------------------------------------------------

describe('the requested count is clamped, never trusted verbatim', () => {
  it('clamps a count above the cap down to 8', async () => {
    await dmCoach.generateExtras(100);
    expect(sentInstructions()).toContain('8');
  });

  it('clamps a count below 1 up to 1', async () => {
    await dmCoach.generateExtras(0);
    expect(sentInstructions()).toContain('Generate 1 ');
  });

  it('falls back to a reasonable default for a non-finite count', async () => {
    await dmCoach.generateExtras(NaN);
    expect(sentInstructions()).toContain('Generate 5 ');
  });
});

// --- 4. defensive normalization ----------------------------------------------

describe('model output is defensively normalized', () => {
  it('drops a draft missing a name or a detail', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({
      extras: [
        { name: 'Good One', detail: 'Has both fields.' },
        { name: '', detail: 'Missing a name.' },
        { name: 'Missing Detail', detail: '' },
        { detail: 'No name key at all.' },
        { name: 'No Detail Key' },
      ],
    });
    const result = await dmCoach.generateExtras(5);
    expect(result).toEqual([{ name: 'Good One', detail: 'Has both fields.' }]);
  });

  it('trims whitespace on both fields', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({
      extras: [{ name: '  Padded Name  ', detail: '  Padded detail.  ' }],
    });
    const result = await dmCoach.generateExtras(1);
    expect(result).toEqual([{ name: 'Padded Name', detail: 'Padded detail.' }]);
  });

  it('never returns more than 8 entries even if the model over-delivers', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({
      extras: Array.from({ length: 20 }, (_, i) => ({ name: `Extra ${i}`, detail: `Detail ${i}.` })),
    });
    const result = await dmCoach.generateExtras(8);
    expect(result.length).toBe(8);
  });

  it('resolves an empty array rather than throwing when the model returns nothing usable', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({ extras: [] });
    await expect(dmCoach.generateExtras(5)).resolves.toEqual([]);
  });

  it('resolves an empty array when the response shape is missing extras entirely', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({});
    await expect(dmCoach.generateExtras(5)).resolves.toEqual([]);
  });
});

// --- 5. tier -----------------------------------------------------------------

describe('tier selection', () => {
  it('runs at the standard tier by default and the lite tier on request', async () => {
    await dmCoach.generateExtras(5);
    expect(sentTier()).toBe('standard');

    await dmCoach.generateExtras(5, undefined, true);
    expect(sentTier(1)).toBe('lite');
  });

  it('forwards the caller campaign context untouched', async () => {
    await dmCoach.generateExtras(5, 'GENERATION-CONTEXT');
    expect(sentContext()).toBe('GENERATION-CONTEXT');
  });
});

// --- 6. the facade -------------------------------------------------------------

describe('the facade owns the mock switch', () => {
  it('routes to the real module when mock mode is off, forwarding count/context/tier', async () => {
    const result = await aiService.generateExtras(4, 'GENERATION-CONTEXT', true, false);
    expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
    expect(sentTier()).toBe('lite');
    expect(sentContext()).toBe('GENERATION-CONTEXT');
    expect(result.length).toBeGreaterThan(0);
  });

  it('defaults to the real path when the flag is left off', async () => {
    await aiService.generateExtras(5);
    expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
  });

  it('routes to the mock when mock mode is on, and never touches the model', async () => {
    const result = await aiService.generateExtras(5, 'GENERATION-CONTEXT', false, true);
    expect(core.generateWithSchema).not.toHaveBeenCalled();
    expect(result.length).toBeGreaterThan(0);
    for (const extra of result) {
      expect(extra.name.length).toBeGreaterThan(0);
      expect(extra.detail.length).toBeGreaterThan(0);
    }
  });
});

// --- 7. the mock -----------------------------------------------------------------

describe('the mock is usable, not decorative', () => {
  it('resolves a well-formed roster sized to the requested count', async () => {
    const result = await mockService.generateExtras(3);
    expect(result.length).toBe(3);
    const names = new Set(result.map((e) => e.name));
    expect(names.size).toBe(3); // distinct, not the same entry repeated
  });

  it('never exceeds its own fixed roster size even for a larger request', async () => {
    const full = await mockService.generateExtras(100);
    const smaller = await mockService.generateExtras(3);
    expect(smaller.length).toBeLessThan(full.length);
    expect(full.length).toBeGreaterThanOrEqual(4);
  });
});
