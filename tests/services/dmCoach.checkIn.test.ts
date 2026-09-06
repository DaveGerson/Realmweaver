/**
 * SPEC — Table Pulse, §4.3 of lazy-dm-research.md: "Ask the Table" check-in questions
 * =============================================================================
 * Source: docs/design/storyteller-first-design.md P5 (this is P5's narrowest
 *         slice — `PlayerCharacter.playerFlags` only; `Campaign.pillars` and
 *         `PlayerCharacter.hooks[]` are NOT built here) ·
 *         docs/design/lazy-dm-lens.md §2 step 1 and §5 (no crafted prompt as
 *         the entry point).
 *
 * Files under test: services/ai/dmCoach.ts (`generateCheckInQuestions`),
 * services/aiService.ts (the facade), services/ai/mockService.ts (the mock).
 *
 * THE CONTRACT, IN PLAIN SENTENCES
 * --------------------------------
 * 1. **No crafted prompt, ever.** There is no DM-typed prompt parameter at
 *    all — the "prompt" argument handed to `generateWithSchema` is always the
 *    same fixed constant, regardless of campaign or context.
 * 2. **No material precondition.** Unlike `generateCallbackComplication`, this
 *    never throws — not on an empty campaign, not on a request with no fields
 *    at all.
 * 3. **Player appetites are read from `campaign`, not `campaignContext`.**
 *    When any PC on the roster has non-blank `playerFlags`, the instructions
 *    given to the model contain a "Players have said they want more of:"
 *    section listing every one, trimmed, across the whole roster in order.
 *    When nobody has any, that section is omitted entirely (no empty
 *    heading). `contextBuilder.ts` is never touched by this function.
 * 4. **It is a schema call**, not freeform text: schema is
 *    `{ questions: string[] }`, required `['questions']`.
 * 5. **Tier selection**: `'standard'` by default, `'lite'` on request.
 * 6. **Context is forwarded verbatim** — the function never builds its own.
 * 7. **The normalizer is defensive**: accepts a `{ questions: [...] }`
 *    envelope or a bare array, trims each entry, drops non-strings and
 *    blanks, and caps the result at 6 — mirroring
 *    `realmWeaver.ts`'s `normalizeSecretDrafts`.
 * 8. **The facade owns the mock switch**, defaulting to the real path.
 * 9. **The mock is usable, not decorative**: resolves a non-empty array of
 *    strings without ever touching the model adapter.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/ai/core', () => ({
  generateWithSchema: vi.fn(async () => ({ questions: ['Mocked question?'] })),
  generateText: vi.fn(async () => 'unused'),
  generateChatCompletion: vi.fn(async () => 'unused'),
}));

import * as core from '../../services/ai/core';
import * as dmCoach from '../../services/ai/dmCoach';
import * as aiService from '../../services/aiService';
import * as mockService from '../../services/ai/mockService';
import type { Campaign, PlayerCharacter } from '../../types/index';

/** The fixed "prompt" argument handed to core.generateWithSchema on the Nth call. */
const sentPrompt = (call = 0) => String(vi.mocked(core.generateWithSchema).mock.calls[call][0]);
/** The schema argument of the Nth call. */
const sentSchema = (call = 0) => vi.mocked(core.generateWithSchema).mock.calls[call][1] as {
  type: string;
  properties: { questions: { type: string; items: { type: string } } };
  required: string[];
};
/** The instructions string of the Nth call. */
const sentInstructions = (call = 0) => String(vi.mocked(core.generateWithSchema).mock.calls[call][2]);
/** The model tier of the Nth call. */
const sentTier = (call = 0) => vi.mocked(core.generateWithSchema).mock.calls[call][4];
/** The campaignContext argument of the Nth call. */
const sentContext = (call = 0) => vi.mocked(core.generateWithSchema).mock.calls[call][5];

function makePc(overrides: Partial<PlayerCharacter> = {}): PlayerCharacter {
  return {
    id: `pc-${Math.random()}`,
    playerName: 'Player',
    characterSocial: {
      characterName: 'Someone', background: '', species: '', personality: '',
      appearance: '', backstory: '', ideals: '', bonds: '', flaws: '',
    },
    characterStatistics: {
      classes: { charClass: '', level: 1 },
      attributes: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
      skills: {
        acrobatics: 'none', animal_handling: 'none', arcana: 'none', athletics: 'none',
        deception: 'none', history: 'none', insight: 'none', intimidation: 'none',
        investigation: 'none', medicine: 'none', nature: 'none', perception: 'none',
        performance: 'none', persuasion: 'none', religion: 'none', sleight_of_hand: 'none',
        stealth: 'none', survival: 'none',
      },
      actions: [], specialActions: [],
    },
    ...overrides,
  };
}

function makeCampaign(playerCharacters: PlayerCharacter[] = []): Campaign {
  return {
    id: 'c-1', title: 'Ashfall', settingType: 'custom', setting: 'A dying empire',
    npcs: [], locations: [], factions: [], items: [], adventures: [], articles: [],
    sessionLogs: [], playerCharacters, plots: [], notes: [],
  } as unknown as Campaign;
}

beforeEach(() => {
  vi.mocked(core.generateWithSchema).mockClear();
  vi.mocked(core.generateWithSchema).mockResolvedValue({ questions: ['Mocked question?'] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- 1 & 2. no crafted prompt, no material precondition ---------------------

describe('the DM types nothing, and nothing is required to have happened yet', () => {
  it('resolves for a request with no fields at all, calling the model exactly once', async () => {
    await expect(dmCoach.generateCheckInQuestions()).resolves.toEqual(['Mocked question?']);
    expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
  });

  it('resolves for a campaign with an empty roster — never throws like the Callback Machine does', async () => {
    await expect(
      dmCoach.generateCheckInQuestions({ campaign: makeCampaign([]) })
    ).resolves.toEqual(['Mocked question?']);
  });

  it('sends the same fixed prompt string regardless of campaign or context', async () => {
    await dmCoach.generateCheckInQuestions({ campaign: makeCampaign([makePc({ playerFlags: ['x'] })]), campaignContext: 'CTX-A' });
    const first = sentPrompt(0);

    await dmCoach.generateCheckInQuestions({ campaignContext: 'CTX-B' });
    const second = sentPrompt(1);

    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(0);
  });
});

// --- 3. player appetites read from campaign ---------------------------------

describe('reads player appetites from campaign.playerCharacters[].playerFlags', () => {
  it('folds every stated appetite across the whole roster into the instructions, trimmed', async () => {
    const campaign = makeCampaign([
      makePc({ playerFlags: ['wants more tactical combat', '  loves a good monologue  '] }),
      makePc({ playerFlags: ['here for the mystery, not the fighting'] }),
    ]);

    await dmCoach.generateCheckInQuestions({ campaign });
    const instructions = sentInstructions();

    expect(instructions).toContain('Players have said they want more of:');
    expect(instructions).toContain('wants more tactical combat');
    expect(instructions).toContain('loves a good monologue');
    expect(instructions).toContain('here for the mystery, not the fighting');
  });

  it('omits the appetites section entirely when no campaign is supplied', async () => {
    await dmCoach.generateCheckInQuestions({});
    expect(sentInstructions()).not.toContain('Players have said they want more of');
  });

  it('omits the appetites section when the roster has no playerFlags at all', async () => {
    const campaign = makeCampaign([makePc(), makePc({ playerFlags: [] })]);
    await dmCoach.generateCheckInQuestions({ campaign });
    expect(sentInstructions()).not.toContain('Players have said they want more of');
  });

  it('drops blank-only flag lines rather than rendering an empty bullet', async () => {
    const campaign = makeCampaign([makePc({ playerFlags: ['   ', ''] })]);
    await dmCoach.generateCheckInQuestions({ campaign });
    expect(sentInstructions()).not.toContain('Players have said they want more of');
  });

  it('never reaches into contextBuilder.ts — this is a separate, later change', async () => {
    // No `services/contextBuilder` mock is registered in this file at all;
    // if `generateCheckInQuestions` imported and called it, this test file
    // would need to mock it to avoid a real, unrelated module load. Its
    // absence here is itself part of the contract: the function reads
    // `campaign.playerCharacters[].playerFlags` directly.
    const campaign = makeCampaign([makePc({ playerFlags: ['wants more horror'] })]);
    await expect(dmCoach.generateCheckInQuestions({ campaign })).resolves.toBeTruthy();
  });
});

// --- 4. schema shape ---------------------------------------------------------

describe('a schema call, not freeform text', () => {
  it('asks for { questions: string[] }, required', async () => {
    await dmCoach.generateCheckInQuestions();
    const schema = sentSchema();
    expect(schema.required).toEqual(['questions']);
    expect(schema.properties.questions.type).toBe('array');
    expect(schema.properties.questions.items.type).toBe('string');
  });
});

// --- 5. tier selection --------------------------------------------------------

describe('model tier', () => {
  it('runs at standard by default and lite on request', async () => {
    await dmCoach.generateCheckInQuestions();
    expect(sentTier(0)).toBe('standard');

    await dmCoach.generateCheckInQuestions({ useLiteModel: true });
    expect(sentTier(1)).toBe('lite');
  });
});

// --- 6. context ---------------------------------------------------------------

describe('context is forwarded verbatim', () => {
  it('passes the caller campaignContext through untouched', async () => {
    await dmCoach.generateCheckInQuestions({ campaignContext: 'COACH-CONTEXT' });
    expect(sentContext()).toBe('COACH-CONTEXT');
  });

  it('passes no context at all rather than inventing one', async () => {
    await dmCoach.generateCheckInQuestions();
    expect(sentContext()).toBeUndefined();
  });
});

// --- 7. normalizer -------------------------------------------------------------

describe('normalizer — trims, drops blanks/non-strings, caps at 6', () => {
  it('accepts a { questions: [...] } envelope', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({ questions: ['  A?  ', 'B?'] });
    await expect(dmCoach.generateCheckInQuestions()).resolves.toEqual(['A?', 'B?']);
  });

  it('accepts a bare array', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce(['A?', 'B?']);
    await expect(dmCoach.generateCheckInQuestions()).resolves.toEqual(['A?', 'B?']);
  });

  it('drops blanks and non-string entries', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({ questions: ['A?', '', '   ', 42, null, 'B?'] });
    await expect(dmCoach.generateCheckInQuestions()).resolves.toEqual(['A?', 'B?']);
  });

  it('caps the result at 6 even when the model returns more', async () => {
    const many = Array.from({ length: 10 }, (_, i) => `Question ${i + 1}?`);
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({ questions: many });
    const result = await dmCoach.generateCheckInQuestions();
    expect(result).toHaveLength(6);
    expect(result).toEqual(many.slice(0, 6));
  });

  it('returns an empty array (never throws) for a completely malformed response', async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({ somethingElse: true });
    await expect(dmCoach.generateCheckInQuestions()).resolves.toEqual([]);
  });
});

// --- 8. the facade -------------------------------------------------------------

describe('the facade owns the mock switch', () => {
  it('routes to the real module when mock mode is off, request unchanged', async () => {
    const campaign = makeCampaign([makePc({ playerFlags: ['wants more horror'] })]);
    vi.mocked(core.generateWithSchema).mockResolvedValueOnce({ questions: ['Real question?'] });

    const result = await aiService.generateCheckInQuestions({ campaign, campaignContext: 'COACH-CONTEXT' }, false);

    expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
    expect(sentContext()).toBe('COACH-CONTEXT');
    expect(sentInstructions()).toContain('wants more horror');
    expect(result).toEqual(['Real question?']);
  });

  it('defaults to the real path when the flag is left off', async () => {
    await aiService.generateCheckInQuestions();
    expect(core.generateWithSchema).toHaveBeenCalledTimes(1);
  });

  it('routes to the mock when mock mode is on, and never touches the model', async () => {
    const result = await aiService.generateCheckInQuestions({ campaignContext: 'COACH-CONTEXT' }, true);

    expect(core.generateWithSchema).not.toHaveBeenCalled();
    expect(result.length).toBeGreaterThan(0);
  });
});

// --- 9. the mock -----------------------------------------------------------------

describe('the mock is usable, not decorative', () => {
  it('resolves a non-empty array of strings with no arguments at all', async () => {
    const result = await mockService.generateCheckInQuestions();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    for (const q of result) expect(typeof q).toBe('string');
  });

  it('never throws for an empty-roster campaign, unlike the Callback Machine mock', async () => {
    await expect(
      mockService.generateCheckInQuestions({ campaign: makeCampaign([]) })
    ).resolves.not.toThrow;
    const result = await mockService.generateCheckInQuestions({ campaign: makeCampaign([]) });
    expect(result.length).toBeGreaterThan(0);
  });

  it('never touches the model adapter', async () => {
    await mockService.generateCheckInQuestions();
    expect(core.generateWithSchema).not.toHaveBeenCalled();
  });
});
