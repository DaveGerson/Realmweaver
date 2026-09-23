/**
 * abort.ts
 *
 * Small, dependency-free helpers for AbortSignal-based cancellation, shared
 * by the AI stack (retry, providers, mock service) and the `useAiRequest`
 * hook. Kept outside `services/ai/` so hooks/components can use them without
 * importing an AI module directly (CLAUDE.md: components import AI only from
 * `services/aiService.ts`).
 */

/** Creates the standard `AbortError` DOMException that `fetch` rejects with. */
export function createAbortError(message = 'The operation was aborted.'): Error {
  if (typeof DOMException === 'function') {
    return new DOMException(message, 'AbortError') as unknown as Error;
  }
  const err = new Error(message);
  err.name = 'AbortError';
  return err;
}

/**
 * True for any cancellation-shaped error: a DOM/fetch `AbortError`, or Node's
 * `ABORT_ERR` code (child_process / timers/promises).
 */
export function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: unknown; code?: unknown };
  return e.name === 'AbortError' || e.code === 'ABORT_ERR';
}

/** Throws an `AbortError` if the signal has already been aborted. */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}

/**
 * Resolves after `ms`, or rejects with an `AbortError` as soon as `signal`
 * aborts (clearing the pending timer so nothing leaks).
 */
export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
