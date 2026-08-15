/**
 * wp-c-ai-services — finding #40 (services/ai/realmChat.ts)
 *
 * `chatWithRealmWeaver` and `generateNpcRoleplay` each wrap their whole body
 * in try/catch and, on ANY failure, resolve successfully with a plausible
 * fake response ("I'm having trouble connecting to the Weave right now." /
 * dialogue "..." + moodCue "seems distracted, saying nothing").
 *
 * Because the promise never rejects, every caller's error path is dead code:
 *   - components/RealmChat/RealmChatWidget.tsx:143 catch
 *   - components/generators/EntityChatGenerator.tsx:131 catch
 *   - DmCoach's setRoleplayError
 * A user with no Claude CLI installed sees the NPC reply "..." forever with
 * no error banner, and the proxy's real diagnostic is dropped into
 * console.error.
 *
 * Desired: propagate the failure (optionally wrapped) so the UI can render it.
 * Every other module in the layer (realmWeaver, dmCoach, evocationWizard,
 * worldSimulation) already propagates.
 *
 * Tested through the public facade (services/aiService.ts) with the AI core
 * mocked — no real AI is ever invoked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CLI_ERROR = "Claude CLI not found at 'claude'. Install the Claude Code CLI or set CLAUDE_CLI_PATH.";

vi.mock('../../services/ai/core', () => ({
  generateWithSchema: vi.fn(),
  generateText: vi.fn(),
  generateChatCompletion: vi.fn(),
}));

import * as core from '../../services/ai/core';
import * as aiService from '../../services/aiService';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(core.generateWithSchema).mockRejectedValue(new Error(CLI_ERROR));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('realmChat propagates provider failures instead of faking a reply (#40)', () => {
  it('chatWithRealmWeaver rejects when the provider fails', async () => {
    await expect(
      aiService.chatWithRealmWeaver(
        [{ id: 'm1', role: 'user', text: 'Make me a tavern keeper', timestamp: 0 }],
        [],
        [],
        'Campaign: Test',
        'medium',
        /* isMockMode */ false
      )
    ).rejects.toThrow(/Claude CLI not found/);
  });

  it('chatWithRealmWeaver never resolves with the canned "trouble connecting" message', async () => {
    const result = await aiService
      .chatWithRealmWeaver(
        [{ id: 'm1', role: 'user', text: 'hello', timestamp: 0 }],
        [],
        [],
        'Campaign: Test',
        'medium',
        false
      )
      .catch(() => null);

    expect(result).toBeNull();
  });

  it('generateNpcRoleplay rejects instead of returning the "..." placeholder', async () => {
    await expect(
      aiService.generateNpcRoleplay(
        'NPC: Grix, a nervous goblin fence.',
        [],
        'What do you know about the sewers?',
        /* isMockMode */ false,
        'Campaign: Test'
      )
    ).rejects.toThrow(/Claude CLI not found/);
  });

  it('generateNpcRoleplay never resolves with the "seems distracted" mood cue', async () => {
    const result = await aiService
      .generateNpcRoleplay('NPC: Grix', [], 'hello', false, 'Campaign: Test')
      .catch(() => null);

    expect(result).toBeNull();
  });
});
