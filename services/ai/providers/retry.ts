/**
 * providers/retry.ts
 *
 * Retry utility for transient AI provider failures. Wraps an async function
 * with configurable retry logic, exponential backoff is not used because
 * AI calls are already long-running and a simple fixed delay is sufficient.
 */

import { abortableDelay, isAbortError, throwIfAborted } from '@/utils/abort';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RetryOptions {
  /** Maximum number of attempts (including the first). Defaults to 2. */
  maxAttempts?: number;
  /** Delay between retries in milliseconds. Defaults to 1500. */
  delayMs?: number;
  /** Label for log messages. Defaults to 'AI call'. */
  label?: string;
  /**
   * Cancels the retry loop. An aborted signal stops further attempts, cuts
   * the inter-attempt delay short, and rethrows the `AbortError` — an abort
   * is never treated as a (retryable) failure.
   */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Retry implementation
// ---------------------------------------------------------------------------

/**
 * Wraps an async function with retry logic. Only retryable errors trigger
 * a retry; non-retryable errors are thrown immediately.
 *
 * Retryable conditions:
 * - Timeout errors (message contains 'timeout' or code is 'ETIMEDOUT')
 * - JSON parse errors (message contains 'JSON')
 * - HTTP 5xx / 504 errors (message contains '504' or '500')
 *
 * Cancellation: when `options.signal` aborts (before, during, or between
 * attempts) the loop stops immediately and rejects with an `AbortError`.
 *
 * @param fn - The async function to execute with retries.
 * @param options - Retry configuration.
 * @returns The result of the function on a successful attempt.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 2, delayMs = 1500, label = 'AI call', signal } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    throwIfAborted(signal);
    try {
      return await fn();
    } catch (err: unknown) {
      // An abort is the caller's decision, not a transient failure: never
      // retry it, and surface an AbortError even if `fn` rejected with some
      // other error after the signal fired.
      if (isAbortError(err)) throw err;
      throwIfAborted(signal);

      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string }).code;

      const isRetryable =
        message.includes('timeout') ||
        message.includes('JSON') ||
        message.includes('504') ||
        message.includes('500') ||
        code === 'ETIMEDOUT';

      if (!isRetryable || attempt === maxAttempts) {
        throw err;
      }

      console.warn(
        `${label}: attempt ${attempt} failed (${message}), retrying in ${delayMs}ms...`
      );
      await abortableDelay(delayMs, signal);
    }
  }

  // Unreachable: the loop always returns or throws.
  throw new Error(`${label}: exhausted all ${maxAttempts} attempts`);
}
