/**
 * wp-c-ai-services — finding #39 (services/ai/providers/registry.ts)
 *
 * `activeProviderName` is hard-initialised to 'claude-cli' and `setProvider`
 * is never called from application code, so REALMWEAVER_AI_PROVIDER is dead.
 * A deployment that sets `REALMWEAVER_AI_PROVIDER=anthropic-api` (as README.md
 * and docs/architecture/technical-design.md instruct) silently keeps using
 * ClaudeCliProvider and every generation fails with "Claude CLI not found".
 *
 * `REALMWEAVER_MAX_RETRIES` is likewise dead — claude-cli.ts hardcodes
 * `{ maxAttempts: 2 }` instead of reading `getProviderConfig().maxRetries`.
 *
 * These tests import the registry through `vi.resetModules()` so the
 * module-level singleton is rebuilt against the env of each case.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_PROVIDER = process.env.REALMWEAVER_AI_PROVIDER;
const ORIGINAL_RETRIES = process.env.REALMWEAVER_MAX_RETRIES;

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  if (ORIGINAL_PROVIDER === undefined) delete process.env.REALMWEAVER_AI_PROVIDER;
  else process.env.REALMWEAVER_AI_PROVIDER = ORIGINAL_PROVIDER;
  if (ORIGINAL_RETRIES === undefined) delete process.env.REALMWEAVER_MAX_RETRIES;
  else process.env.REALMWEAVER_MAX_RETRIES = ORIGINAL_RETRIES;
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('provider registry honours REALMWEAVER_AI_PROVIDER (#39)', () => {
  it('selects anthropic-api when the env var asks for it', async () => {
    process.env.REALMWEAVER_AI_PROVIDER = 'anthropic-api';
    vi.resetModules();

    const registry = await import('../../services/ai/providers/registry');

    expect(registry.getProviderName()).toBe('anthropic-api');
    expect(registry.getActiveProvider().name).toBe('anthropic-api');
  });

  it('still defaults to claude-cli when the env var is absent', async () => {
    delete process.env.REALMWEAVER_AI_PROVIDER;
    vi.resetModules();

    const registry = await import('../../services/ai/providers/registry');

    expect(registry.getProviderName()).toBe('claude-cli');
    expect(registry.getActiveProvider().name).toBe('claude-cli');
  });

  it('ignores an unrecognised provider name and falls back to claude-cli', async () => {
    process.env.REALMWEAVER_AI_PROVIDER = 'llama-local';
    vi.resetModules();

    const registry = await import('../../services/ai/providers/registry');

    expect(registry.getProviderName()).toBe('claude-cli');
  });
});

describe('ClaudeCliProvider honours REALMWEAVER_MAX_RETRIES (#39)', () => {
  it('makes getProviderConfig().maxRetries attempts on a retryable failure', async () => {
    process.env.REALMWEAVER_MAX_RETRIES = '3';
    vi.resetModules();

    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 504,
      json: async () => ({ error: 'upstream timeout', code: 'ETIMEDOUT' }),
    }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    const { ClaudeCliProvider } = await import('../../services/ai/providers/claude-cli');
    const provider = new ClaudeCliProvider();

    await expect(
      provider.generateText({ prompt: 'hello', model: 'standard' })
    ).rejects.toThrow();

    // Hardcoded `maxAttempts: 2` in claude-cli.ts makes this 2 today.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 20000);
});
