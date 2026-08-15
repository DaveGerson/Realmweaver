/**
 * wp-c-ai-services — finding #96 (services/ai/dmCoach.ts:115)
 *
 * `buildFreeformPrompt` does
 *     config.userPromptTemplate.replace('{{prompt}}', prompt)
 * With a STRING pattern the *replacement* argument still honours `$`
 * substitution patterns, so user text containing `$&`, "$`", `$'` or `$$`
 * is silently corrupted before it reaches the model:
 *   - `$&`  → expands to the matched text, i.e. the literal `{{prompt}}`
 *   - "$`"  → splices in everything before the placeholder
 *   - `$'`  → splices in everything after the placeholder
 *   - `$$`  → collapses to a single `$`
 *
 * This affects all three freeform tools (narration, improvisation, enhanced
 * text) — i.e. every DM Coach call and every per-field Regenerate button.
 *
 * Fix: use a function replacement (`.replace('{{prompt}}', () => prompt)`) or
 * split/join on the placeholder so the DM's text is inserted literally.
 *
 * Tested through the public facade with the AI core mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../services/ai/core', () => ({
  generateWithSchema: vi.fn(async () => ({})),
  generateText: vi.fn(async () => 'ok'),
  generateChatCompletion: vi.fn(async () => 'ok'),
}));

import * as core from '../../services/ai/core';
import * as aiService from '../../services/aiService';

beforeEach(() => {
  vi.mocked(core.generateText).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** The full prompt string handed to core.generateText on the Nth call. */
const sentPrompt = (call = 0) => String(vi.mocked(core.generateText).mock.calls[call][0]);

describe('dmCoach freeform prompts insert user text literally (#96)', () => {
  it('preserves a literal "$&" typed by the DM', async () => {
    const userText = 'The rogue yells "grab it!" $& runs';

    await aiService.generateNarration(userText, 'Campaign: Test', false, false);

    const prompt = sentPrompt();
    expect(prompt).toContain(userText);
    // `$&` currently expands to the matched pattern, re-injecting the
    // placeholder into the prompt the model receives.
    expect(prompt).not.toContain('{{prompt}}');
  });

  it('preserves a literal "$$" in improvisation prompts', async () => {
    const userText = 'The party finds a chest with $$500 in gold';

    await aiService.generateImprovisation(userText, 'Campaign: Test', false, false);

    expect(sentPrompt()).toContain(userText);
  });

  it("preserves a literal \"$`\" in enhanced-text prompts", async () => {
    const userText = 'Describe the sigil: $` marks the seal';

    await aiService.generateEnhancedText(userText, 'Campaign: Test', false);

    const prompt = sentPrompt();
    expect(prompt).toContain(userText);
    expect(prompt).not.toContain('You are a creative assistant for a Dungeon Master. marks the seal');
  });
});
