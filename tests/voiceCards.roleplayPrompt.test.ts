/**
 * SPEC — the roleplay system instruction acknowledges the voice sections
 * (Wave 2, lane VOICE / P3).
 *
 * Source: docs/design/storyteller-first-design.md §P3. The voice work reaches
 * the model as extra sections inside the `npcContext` string the DM Coach
 * hand-builds (see tests/voiceCards.roleplayContext.test.tsx). A section the
 * template never mentions is a section the model is free to ignore, so
 * `services/ai/realmChat.ts` gains exactly one thing: prompt text telling the
 * model that a voice brief and a record of lines already spoken may be present,
 * and that they are binding.
 *
 * THE CONTRACT
 *
 * 1. THE SIGNATURE DOES NOT MOVE. `generateNpcRoleplay(npcContext,
 *    conversationHistory, userMessage, campaignContext?)` — four parameters,
 *    unchanged. No provider-side plumbing for voice, no new argument, and
 *    nothing added to `services/aiService.ts` or `services/ai/mockService.ts`.
 *
 * 2. THE BRIEF IS STILL EMBEDDED VERBATIM. Whatever the call site built is
 *    passed into the system instruction as-is — that is how voiceNotes and the
 *    ledger lines arrive.
 *
 * 3. THE TEMPLATE ACKNOWLEDGES THE VOICE. The system instruction tells the
 *    model to speak in the NPC's documented voice and to stay consistent with
 *    lines the NPC has already spoken at the table.
 *
 * 4. NOTHING THE TEMPLATE ALREADY PROMISED IS LOST. First person, no breaking
 *    character, secrets held back unless pressed, 2–4 sentences, a mood cue,
 *    and a JSON response with exactly `dialogue` and `moodCue`.
 *
 * 5. THE RESPONSE SCHEMA IS UNCHANGED. Still `dialogue` + `moodCue`, both
 *    required. Failures still propagate (wp-c-ai-services #40) — this lane adds
 *    prompt text, nothing else.
 *
 * No real AI is invoked: `services/ai/core` is mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/ai/core', () => ({
    generateWithSchema: vi.fn(),
    generateText: vi.fn(),
    generateChatCompletion: vi.fn(),
}));

import * as core from '../services/ai/core';
import { generateNpcRoleplay } from '../services/ai/realmChat';

const NPC_CONTEXT = [
    'Name: Serah Vantt',
    'Traits: Counts on her fingers when lying.',
    "Voice: Clipped sentences, never uses contractions, calls everyone 'pet'.",
    'Lines she has actually spoken at the table (most recent first):',
    '- "Tide is in, pet."',
].join('\n');

const callArgs = () => vi.mocked(core.generateWithSchema).mock.calls[0];
const systemInstruction = () => callArgs()[2] as string;
/**
 * The system instruction with the hand-built brief cut out — the template's own
 * words, so an assertion about the template can never be satisfied by text the
 * call site happened to pass in.
 */
const template = () => systemInstruction().replace(NPC_CONTEXT, '');
const responseSchema = () => callArgs()[1] as { properties: Record<string, unknown>; required: string[] };

beforeEach(async () => {
    vi.mocked(core.generateWithSchema).mockResolvedValue({ dialogue: 'Tide is out.', moodCue: 'does not look up' });
    await generateNpcRoleplay(NPC_CONTEXT, [], 'Is the harbour open?', 'Campaign: Ashfall');
});

afterEach(() => {
    vi.clearAllMocks();
});

// ── 1. The signature does not move ────────────────────────────────────────────

describe('generateNpcRoleplay — the provider contract is unchanged', () => {
    it('still takes four parameters', () => {
        expect(generateNpcRoleplay.length).toBe(4);
    });

    it('still passes the prompt, schema, system instruction and campaign context through', () => {
        const [prompt, , , , , campaignContext] = callArgs();
        expect(prompt).toContain('Is the harbour open?');
        expect(campaignContext).toBe('Campaign: Ashfall');
    });
});

// ── 2. The brief is embedded verbatim ─────────────────────────────────────────

describe('generateNpcRoleplay — the hand-built brief arrives intact', () => {
    it('embeds the whole npcContext in the system instruction', () => {
        expect(systemInstruction()).toContain(NPC_CONTEXT);
    });
});

// ── 3. The template acknowledges the voice ────────────────────────────────────

describe('generateNpcRoleplay — the template is told the voice is binding', () => {
    it('instructs the model about the NPC\'s documented voice', () => {
        expect(template()).toMatch(/voice/i);
    });

    it('instructs the model to stay consistent with lines already spoken at the table', () => {
        expect(template()).toMatch(/spoken|already said|previously said|lines .*(said|spoken)/i);
    });
});

// ── 4 & 5. Nothing already promised is lost ───────────────────────────────────

describe('generateNpcRoleplay — the existing roleplay rules survive', () => {
    it.each([
        ['first person', /first person/i],
        ['never breaking character', /never break character|stay .*in character/i],
        ['holding secrets back', /secret/i],
        ['a length cap', /2-4 sentences|2–4 sentences/i],
        ['a mood cue', /mood cue/i],
        ['a two-field JSON response', /"dialogue"[\s\S]*"moodCue"/],
    ])('still asks for %s', (_label, pattern) => {
        expect(systemInstruction()).toMatch(pattern);
    });

    it('still declares the same response schema', () => {
        expect(Object.keys(responseSchema().properties).sort()).toEqual(['dialogue', 'moodCue']);
        expect(responseSchema().required.sort()).toEqual(['dialogue', 'moodCue']);
    });
});
