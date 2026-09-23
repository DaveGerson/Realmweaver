/**
 * Roadmap L1 — AbortSignal cancellation through the AI stack
 * (retry → claude-cli provider → core → facade → mock), plus X2's single
 * tier-mapping table (`modelConfig.toModelTier`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from '@/services/ai/providers/retry';
import { ClaudeCliProvider } from '@/services/ai/providers/claude-cli';
import { toModelTier, resolveModelName } from '@/services/ai/modelConfig';
import { isAbortError, abortableDelay } from '@/utils/abort';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('withRetry — abort behaviour', () => {
  it('never calls fn when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn().mockResolvedValue('x');
    await expect(withRetry(fn, { signal: controller.signal })).rejects.toSatisfy(isAbortError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not retry an AbortError even though retries remain', async () => {
    const abortErr = new DOMException('aborted', 'AbortError');
    const fn = vi.fn().mockRejectedValue(abortErr);
    await expect(withRetry(fn, { maxAttempts: 3, delayMs: 1 })).rejects.toBe(abortErr);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('stops during the inter-attempt delay when aborted, without another attempt', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error('Request timeout'));
    const promise = withRetry(fn, { maxAttempts: 3, delayMs: 10_000, signal: controller.signal });
    // Let the first attempt fail and the delay start.
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    await expect(promise).rejects.toSatisfy(isAbortError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('surfaces an AbortError when the signal fired while fn failed with a retryable error', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockImplementation(async () => {
      controller.abort();
      throw new Error('500 upstream');
    });
    await expect(withRetry(fn, { maxAttempts: 3, delayMs: 1, signal: controller.signal })).rejects.toSatisfy(isAbortError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('still retries normally when a signal is supplied but never aborted', async () => {
    const controller = new AbortController();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Request timeout'))
      .mockResolvedValueOnce('ok');
    await expect(withRetry(fn, { maxAttempts: 2, delayMs: 1, signal: controller.signal })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('abortableDelay', () => {
  it('rejects with an AbortError as soon as the signal aborts', async () => {
    const controller = new AbortController();
    const p = abortableDelay(60_000, controller.signal);
    controller.abort();
    await expect(p).rejects.toSatisfy(isAbortError);
  });

  it('resolves normally without a signal', async () => {
    await expect(abortableDelay(1)).resolves.toBeUndefined();
  });
});

function abortableFetchMock() {
  return vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
  }));
}

describe('ClaudeCliProvider — abort', () => {
  it('forwards the signal to fetch and rejects with AbortError without retrying', async () => {
    const fetchMock = abortableFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    const provider = new ClaudeCliProvider();
    const p = provider.generateWithSchema({
      prompt: 'p', schema: {}, instructions: 'i', model: 'standard', signal: controller.signal,
    });
    await Promise.resolve();
    controller.abort();

    await expect(p).rejects.toSatisfy(isAbortError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });

  it('aborts generateText and generateChatCompletion the same way', async () => {
    const fetchMock = abortableFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    const provider = new ClaudeCliProvider();

    const c1 = new AbortController();
    const t = provider.generateText({ prompt: 'p', model: 'lite', signal: c1.signal });
    const c2 = new AbortController();
    const c = provider.generateChatCompletion({
      history: [{ role: 'user', parts: [{ text: 'hi' }] }], systemInstruction: 's', model: 'lite', signal: c2.signal,
    });
    c1.abort();
    c2.abort();
    await expect(t).rejects.toSatisfy(isAbortError);
    await expect(c).rejects.toSatisfy(isAbortError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('aiService facade — signal threading', () => {
  it('mock-mode generateNpc rejects with AbortError when aborted (no entity data)', async () => {
    const { generateNpc } = await import('@/services/aiService');
    const controller = new AbortController();
    const p = generateNpc('a dwarf', true, undefined, controller.signal);
    controller.abort();
    await expect(p).rejects.toSatisfy(isAbortError);
  });

  it('mock-mode chatWithRealmWeaver rejects with AbortError when aborted', async () => {
    const { chatWithRealmWeaver } = await import('@/services/aiService');
    const controller = new AbortController();
    const p = chatWithRealmWeaver(
      [{ id: '1', role: 'user', text: 'hi', timestamp: 0 }], [], [], '', 'standard', true, undefined, controller.signal,
    );
    controller.abort();
    await expect(p).rejects.toSatisfy(isAbortError);
  });

  it('real-mode generateFaction forwards the signal down to the provider fetch', async () => {
    const fetchMock = abortableFetchMock();
    vi.stubGlobal('fetch', fetchMock);
    const { generateFaction } = await import('@/services/aiService');
    const controller = new AbortController();
    const p = generateFaction('a guild', false, undefined, controller.signal);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
    controller.abort();
    await expect(p).rejects.toSatisfy(isAbortError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('X2 — single model-tier table', () => {
  it('maps canonical, retired RealmChat, and legacy Gemini names', () => {
    expect(toModelTier('lite')).toBe('lite');
    expect(toModelTier('standard')).toBe('standard');
    expect(toModelTier('quality')).toBe('quality');
    expect(toModelTier('performance')).toBe('lite');
    expect(toModelTier('medium')).toBe('standard');
    expect(toModelTier('gemini-2.5-pro')).toBe('quality');
    expect(toModelTier('gemini-flash-lite-latest')).toBe('lite');
    expect(toModelTier('nonsense')).toBe('standard');
    expect(toModelTier(undefined)).toBe('standard');
  });

  it('resolveModelName honours retired RealmChat tier names', () => {
    expect(resolveModelName('performance')).toBe('haiku');
    expect(resolveModelName('medium')).toBe('sonnet');
    expect(resolveModelName('quality')).toBe('opus');
  });

  it('realmChat routes a legacy "performance" tier to the lite (haiku) CLI model', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => ({ result: JSON.stringify({ message: 'hi', suggestions: [], draftEntities: [] }) }),
    }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);
    const { chatWithRealmWeaver } = await import('@/services/aiService');
    await chatWithRealmWeaver([{ id: '1', role: 'user', text: 'hi', timestamp: 0 }], [], [], '', 'performance', false);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.model).toBe('haiku');
  });
});
