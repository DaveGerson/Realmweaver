import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Outcome of one `run()` call.
 *
 * - `success`   — the request completed and is still the current one; `data`
 *                 is safe to commit (create the entity, update state, ...).
 * - `error`     — the request failed for a real reason; `error` is the raw
 *                 value so callers can log it with its stack.
 * - `cancelled` — the request was aborted (cancel(), a newer run(), or the
 *                 component unmounted). Callers must do NOTHING: in the
 *                 unmount case, touching state or creating an entity through
 *                 a stale closure is exactly the bug this hook prevents.
 */
export type AiRequestOutcome<T> =
  | { status: 'success'; data: T }
  | { status: 'error'; error: unknown }
  | { status: 'cancelled' };

export interface UseAiRequestResult<T> {
  /**
   * Starts a request. Any in-flight request from this hook is aborted first.
   * `fn` receives the AbortSignal to forward to the aiService facade
   * (e.g. `signal => generateNpc(prompt, isMockMode, ctx, signal)`).
   * Never rejects.
   */
  run: (fn: (signal: AbortSignal) => Promise<T>) => Promise<AiRequestOutcome<T>>;
  /** Aborts the in-flight request (no-op when idle). */
  cancel: () => void;
  isLoading: boolean;
  /** The last real (non-abort) error, cleared when a new run starts. */
  error: unknown;
}

/**
 * Owns an AbortController for AI calls made from a component.
 *
 * - aborts the in-flight request on unmount and whenever `run` is called again
 * - exposes `cancel()` for a visible Cancel affordance
 * - resolves a request that finished after it was aborted/superseded as
 *   `cancelled`, even if the underlying call ignored the signal — so a slow
 *   response can never land against a stale closure
 */
export function useAiRequest<T>(): UseAiRequestResult<T> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    // Set true in the effect body (not just the initial ref value) so the
    // guard survives StrictMode's mount -> cleanup -> remount cycle.
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
      controllerRef.current = null;
    };
  }, []);

  const cancel = useCallback(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    controller.abort();
    controllerRef.current = null;
    if (mountedRef.current) setIsLoading(false);
  }, []);

  const run = useCallback(async (fn: (signal: AbortSignal) => Promise<T>): Promise<AiRequestOutcome<T>> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;

    // Current = not aborted, not superseded by a newer run, still mounted.
    const isCurrent = () =>
      !signal.aborted && controllerRef.current === controller && mountedRef.current;

    setIsLoading(true);
    setError(null);
    try {
      const data = await fn(signal);
      if (!isCurrent()) return { status: 'cancelled' };
      return { status: 'success', data };
    } catch (err) {
      if (!isCurrent()) return { status: 'cancelled' };
      setError(err);
      return { status: 'error', error: err };
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        if (mountedRef.current) setIsLoading(false);
      }
    }
  }, []);

  return { run, cancel, isLoading, error };
}
