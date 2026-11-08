/**
 * generateSessionRecap writes the GM recap, the loose ends and the player recap
 * in one model call. The DM reads and edits the player recap in SessionEndWizard
 * before sharing it; what the party has discovered reaches the model through the
 * reveal-state sections of the campaign context.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/ai/core', () => ({
  generateWithSchema: vi.fn(),
  generateText: vi.fn(async () => 'ok'),
  generateChatCompletion: vi.fn(async () => 'ok'),
}));

import * as core from '../../services/ai/core';
import { generateSessionRecap } from '../../services/ai/dmCoach';

const NOTES = 'The party bargained with the Chancellor and left before dawn.';
const PLOTS = '- The Quiet Debt: the Chancellor is calling it in.';
const CONTEXT = 'Campaign: The Ashen Compact';
const MODEL_RESULT = {
  recap: 'The party struck a bargain in the Ash Court.',
  looseEnds: ['The Chancellor still has the writ.'],
  playerFacingRecap: 'You made a deal and slipped away before dawn.',
};

const calls = () => vi.mocked(core.generateWithSchema).mock.calls;

beforeEach(() => {
  vi.mocked(core.generateWithSchema).mockReset();
  vi.mocked(core.generateWithSchema).mockResolvedValue(MODEL_RESULT);
});

describe('generateSessionRecap', () => {
  it('asks for all three fields in a single model call', async () => {
    await generateSessionRecap(NOTES, PLOTS, CONTEXT);

    expect(calls()).toHaveLength(1);
    const schema = calls()[0][1] as { required: string[] };
    expect(schema.required).toEqual(['recap', 'looseEnds', 'playerFacingRecap']);
  });

  it('returns what the model wrote', async () => {
    await expect(generateSessionRecap(NOTES, PLOTS, CONTEXT)).resolves.toEqual(MODEL_RESULT);
  });

  it('sends the notes, plot summaries and campaign context at the standard tier', async () => {
    await generateSessionRecap(NOTES, PLOTS, CONTEXT);

    const [prompt, , instructions, , tier, context] = calls()[0];
    expect(prompt).toContain(NOTES);
    expect(instructions).toContain(PLOTS);
    expect(tier).toBe('standard');
    expect(context).toBe(CONTEXT);
  });

  // Both recaps reach the players (the recap is read aloud next session); the
  // loose ends are the DM's own follow-up list.
  it('keeps undiscovered material out of both recaps, and lets the loose ends name it', async () => {
    await generateSessionRecap(NOTES, PLOTS, CONTEXT);

    const instructions = String(calls()[0][2]);
    const spoilerRule = instructions.split('\n').find(line => /not (yet )?discovered/i.test(line)) ?? '';
    expect(spoilerRule).toMatch(/\brecap\b/);
    expect(spoilerRule).toContain('playerFacingRecap');
    expect(spoilerRule).toMatch(/looseEnds[^.]*private/i);
  });
});
