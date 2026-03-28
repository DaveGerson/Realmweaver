import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from '../services/ai/providers/retry';

// Suppress console.warn during retry tests
beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Successful calls
// ---------------------------------------------------------------------------

describe('withRetry — successful calls', () => {
    it('returns the result on first attempt', async () => {
        const fn = vi.fn().mockResolvedValue('success');
        const result = await withRetry(fn);
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('passes through the resolved value', async () => {
        const fn = vi.fn().mockResolvedValue({ data: 42 });
        const result = await withRetry(fn);
        expect(result).toEqual({ data: 42 });
    });
});

// ---------------------------------------------------------------------------
// Retryable errors
// ---------------------------------------------------------------------------

describe('withRetry — retryable errors', () => {
    it('retries on timeout error and succeeds on second attempt', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('Request timeout'))
            .mockResolvedValueOnce('recovered');

        const result = await withRetry(fn, { maxAttempts: 2, delayMs: 0 });
        expect(result).toBe('recovered');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries on JSON parse error', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('Unexpected token in JSON at position 0'))
            .mockResolvedValueOnce('ok');

        const result = await withRetry(fn, { maxAttempts: 2, delayMs: 0 });
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('retries on 504 gateway timeout', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('HTTP 504 Gateway Timeout'))
            .mockResolvedValueOnce('ok');

        const result = await withRetry(fn, { maxAttempts: 2, delayMs: 0 });
        expect(result).toBe('ok');
    });

    it('retries on 500 internal server error', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('HTTP 500 Internal Server Error'))
            .mockResolvedValueOnce('ok');

        const result = await withRetry(fn, { maxAttempts: 2, delayMs: 0 });
        expect(result).toBe('ok');
    });

    it('retries on ETIMEDOUT error code', async () => {
        const err = new Error('connect failed');
        (err as any).code = 'ETIMEDOUT';
        const fn = vi.fn()
            .mockRejectedValueOnce(err)
            .mockResolvedValueOnce('ok');

        const result = await withRetry(fn, { maxAttempts: 2, delayMs: 0 });
        expect(result).toBe('ok');
    });

    it('retries up to maxAttempts before throwing', async () => {
        const fn = vi.fn()
            .mockRejectedValue(new Error('timeout'));

        await expect(withRetry(fn, { maxAttempts: 3, delayMs: 0 })).rejects.toThrow('timeout');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('succeeds on the last attempt', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('timeout'))
            .mockRejectedValueOnce(new Error('timeout'))
            .mockResolvedValueOnce('finally');

        const result = await withRetry(fn, { maxAttempts: 3, delayMs: 0 });
        expect(result).toBe('finally');
        expect(fn).toHaveBeenCalledTimes(3);
    });
});

// ---------------------------------------------------------------------------
// Non-retryable errors
// ---------------------------------------------------------------------------

describe('withRetry — non-retryable errors', () => {
    it('throws immediately for authentication errors', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('Invalid API key'));

        await expect(withRetry(fn, { maxAttempts: 3, delayMs: 0 })).rejects.toThrow('Invalid API key');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws immediately for generic errors', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('Model not found'));

        await expect(withRetry(fn, { maxAttempts: 3, delayMs: 0 })).rejects.toThrow('Model not found');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws immediately for validation errors', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('Request body too large'));

        await expect(withRetry(fn, { maxAttempts: 3, delayMs: 0 })).rejects.toThrow('Request body too large');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws immediately for rate limit errors (no retry keyword match)', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('Rate limit exceeded: 429'));

        await expect(withRetry(fn, { maxAttempts: 3, delayMs: 0 })).rejects.toThrow('Rate limit exceeded');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('preserves the original error object when throwing', async () => {
        const originalError = new Error('timeout');
        (originalError as any).status = 504;
        const fn = vi.fn().mockRejectedValue(originalError);

        try {
            await withRetry(fn, { maxAttempts: 1, delayMs: 0 });
            expect.unreachable('Should have thrown');
        } catch (err) {
            expect(err).toBe(originalError);
            expect((err as any).status).toBe(504);
        }
    });
});

// ---------------------------------------------------------------------------
// Default options
// ---------------------------------------------------------------------------

describe('withRetry — default options', () => {
    it('defaults to 2 maxAttempts', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('timeout'));

        await expect(withRetry(fn, { delayMs: 0 })).rejects.toThrow();
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('defaults label to "AI call" in warning messages', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('timeout'))
            .mockResolvedValueOnce('ok');

        await withRetry(fn, { delayMs: 0 });
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('AI call')
        );
    });

    it('uses custom label in warning messages', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('timeout'))
            .mockResolvedValueOnce('ok');

        await withRetry(fn, { label: 'NPC generation', delayMs: 0 });
        expect(console.warn).toHaveBeenCalledWith(
            expect.stringContaining('NPC generation')
        );
    });
});

// ---------------------------------------------------------------------------
// Delay behavior
// ---------------------------------------------------------------------------

describe('withRetry — delay', () => {
    it('waits between retries', async () => {
        vi.useFakeTimers();

        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('timeout'))
            .mockResolvedValueOnce('ok');

        const promise = withRetry(fn, { maxAttempts: 2, delayMs: 1500 });

        // First call fails immediately, then setTimeout is called
        await vi.advanceTimersByTimeAsync(0); // flush microtasks from first rejection
        expect(fn).toHaveBeenCalledTimes(1);

        // Advance past the delay
        await vi.advanceTimersByTimeAsync(1500);
        const result = await promise;
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(2);

        vi.useRealTimers();
    });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('withRetry — edge cases', () => {
    it('handles maxAttempts of 1 (no retry)', async () => {
        const fn = vi.fn().mockRejectedValueOnce(new Error('timeout'));

        await expect(withRetry(fn, { maxAttempts: 1, delayMs: 0 })).rejects.toThrow('timeout');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('handles non-Error throwable (string)', async () => {
        const fn = vi.fn().mockRejectedValueOnce('string error');

        // String error doesn't contain retryable keywords, so no retry
        await expect(withRetry(fn, { maxAttempts: 3, delayMs: 0 })).rejects.toBe('string error');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('handles non-Error throwable (string with timeout)', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce('connection timeout occurred')
            .mockResolvedValueOnce('ok');

        const result = await withRetry(fn, { maxAttempts: 2, delayMs: 0 });
        expect(result).toBe('ok');
    });

    it('does not log warning on the final failed attempt', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('timeout'));

        await expect(withRetry(fn, { maxAttempts: 2, delayMs: 0 })).rejects.toThrow();
        // Warning is logged on attempt 1 (before retry) but not on attempt 2 (the final throw)
        expect(console.warn).toHaveBeenCalledTimes(1);
    });
});
