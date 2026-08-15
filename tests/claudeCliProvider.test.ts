import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeCliProvider } from '../services/ai/providers/claude-cli';

// Suppress console noise from withRetry's warn logs and parseJsonResponse's
// diagnostic error logs during these tests.
beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, ok = true, status = 200) {
    return {
        ok,
        status,
        json: async () => body,
    } as Response;
}

// ---------------------------------------------------------------------------
// Timeout code propagation (finding: retry.ts's `code === 'ETIMEDOUT'` check
// never fires for real proxy timeouts because rawCallApi threw a plain
// `Error(message)` with no `.code`, and the message text never contained a
// retryable keyword either).
// ---------------------------------------------------------------------------

describe('ClaudeCliProvider — timeout retry via propagated error code', () => {
    it('retries a 504 response even when the error message has no retryable keyword', async () => {
        const fetchMock = vi.fn()
            // First call: proxy reports a timeout via a 504 status but with a
            // message that contains none of 'timeout' / 'JSON' / '504' / '500'.
            .mockResolvedValueOnce(jsonResponse({ error: 'Something went wrong upstream' }, false, 504))
            // Second call: succeeds.
            .mockResolvedValueOnce(jsonResponse({ result: 'recovered text' }));
        vi.stubGlobal('fetch', fetchMock);

        const provider = new ClaudeCliProvider();
        const result = await provider.generateText({ prompt: 'hello', model: 'standard' });

        expect(result).toBe('recovered text');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('propagates a code from the proxy response body verbatim', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ error: 'timed out upstream', code: 'ETIMEDOUT' }, false, 504))
            .mockResolvedValueOnce(jsonResponse({ result: 'ok' }));
        vi.stubGlobal('fetch', fetchMock);

        const provider = new ClaudeCliProvider();
        const result = await provider.generateText({ prompt: 'hello', model: 'standard' });

        expect(result).toBe('ok');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry a non-timeout 4xx failure', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValue(jsonResponse({ error: 'Missing required field: prompt' }, false, 400));
        vi.stubGlobal('fetch', fetchMock);

        const provider = new ClaudeCliProvider();
        await expect(
            provider.generateText({ prompt: 'hello', model: 'standard' })
        ).rejects.toThrow('Missing required field: prompt');
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// JSON parse retry (finding: parseJsonResponse ran outside the retried
// scope in generateWithSchema, so a malformed JSON payload never triggered
// a retry despite retry.ts documenting that condition as retryable).
// ---------------------------------------------------------------------------

describe('ClaudeCliProvider — generateWithSchema retries on malformed JSON', () => {
    it('retries when the first response is not valid JSON and succeeds on the second', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(jsonResponse({ result: 'not valid json {{{' }))
            .mockResolvedValueOnce(jsonResponse({ result: JSON.stringify({ ok: true }) }));
        vi.stubGlobal('fetch', fetchMock);

        const provider = new ClaudeCliProvider();
        const result = await provider.generateWithSchema<{ ok: boolean }>({
            prompt: 'generate something',
            schema: { type: 'object' },
            instructions: 'Be concise.',
            model: 'standard',
        });

        expect(result).toEqual({ ok: true });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws the invalid-JSON error after exhausting retries', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValue(jsonResponse({ result: 'still not json {{{' }));
        vi.stubGlobal('fetch', fetchMock);

        const provider = new ClaudeCliProvider();
        await expect(
            provider.generateWithSchema({
                prompt: 'generate something',
                schema: { type: 'object' },
                instructions: 'Be concise.',
                model: 'standard',
            })
        ).rejects.toThrow('Received an invalid JSON response');
        // ClaudeCliProvider now reads maxAttempts from
        // getProviderConfig().maxRetries (finding #39) instead of a
        // hardcoded 2, whose documented default (no env var set) is 3.
        expect(fetchMock).toHaveBeenCalledTimes(3);
    }, 20000);
});
