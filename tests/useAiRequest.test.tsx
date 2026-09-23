// @vitest-environment jsdom
/**
 * Roadmap L1 — `hooks/useAiRequest` and its adoption by the quick generators.
 *
 * Failure mode pinned: a slow AI request that outlives its generator (unmount,
 * campaign switch, user cancel) used to resolve and create an entity through a
 * stale closure. The hook must abort the request's signal on unmount / cancel /
 * re-run, and report any late result as `cancelled` so nothing is committed.
 */
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { useAiRequest, type AiRequestOutcome } from '@/hooks/useAiRequest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** A request whose settlement the test controls, and that ignores its signal. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('useAiRequest', () => {
  it('returns success with the data and toggles isLoading', async () => {
    const { result } = renderHook(() => useAiRequest<string>());
    const d = deferred<string>();
    let outcomeP!: Promise<AiRequestOutcome<string>>;
    act(() => { outcomeP = result.current.run(() => d.promise); });
    expect(result.current.isLoading).toBe(true);
    await act(async () => { d.resolve('done'); });
    await expect(outcomeP).resolves.toEqual({ status: 'success', data: 'done' });
    expect(result.current.isLoading).toBe(false);
  });

  it('aborts the signal on unmount and reports a late result as cancelled', async () => {
    const { result, unmount } = renderHook(() => useAiRequest<string>());
    const d = deferred<string>();
    let signal!: AbortSignal;
    let outcomeP!: Promise<AiRequestOutcome<string>>;
    act(() => {
      outcomeP = result.current.run((s) => { signal = s; return d.promise; });
    });
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
    // The underlying call ignored the signal and resolved anyway.
    d.resolve('stale');
    await expect(outcomeP).resolves.toEqual({ status: 'cancelled' });
  });

  it('cancel() aborts, clears isLoading, and swallows the resulting AbortError', async () => {
    const { result } = renderHook(() => useAiRequest<string>());
    let outcomeP!: Promise<AiRequestOutcome<string>>;
    act(() => {
      outcomeP = result.current.run((s) => new Promise<string>((_r, rej) => {
        s.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      }));
    });
    act(() => { result.current.cancel(); });
    expect(result.current.isLoading).toBe(false);
    await expect(outcomeP).resolves.toEqual({ status: 'cancelled' });
    expect(result.current.error).toBeNull();
  });

  it('a new run aborts and supersedes the previous one', async () => {
    const { result } = renderHook(() => useAiRequest<string>());
    const first = deferred<string>();
    const second = deferred<string>();
    let firstSignal!: AbortSignal;
    let p1!: Promise<AiRequestOutcome<string>>;
    let p2!: Promise<AiRequestOutcome<string>>;
    act(() => { p1 = result.current.run((s) => { firstSignal = s; return first.promise; }); });
    act(() => { p2 = result.current.run(() => second.promise); });
    expect(firstSignal.aborted).toBe(true);
    await act(async () => {
      first.resolve('old');
      second.resolve('new');
    });
    await expect(p1).resolves.toEqual({ status: 'cancelled' });
    await expect(p2).resolves.toEqual({ status: 'success', data: 'new' });
    expect(result.current.isLoading).toBe(false);
  });

  it('returns a real error as status error and exposes it', async () => {
    const { result } = renderHook(() => useAiRequest<string>());
    const boom = new Error('proxy 500');
    let outcome!: AiRequestOutcome<string>;
    await act(async () => { outcome = await result.current.run(async () => { throw boom; }); });
    expect(outcome).toEqual({ status: 'error', error: boom });
    expect(result.current.error).toBe(boom);
  });
});

// ---------------------------------------------------------------------------
// Generator adoption — real component, aiService mocked.
// ---------------------------------------------------------------------------

const ai = vi.hoisted(() => ({
  pending: null as null | { resolve: (v: unknown) => void; signal: AbortSignal },
}));

vi.mock('@/services/aiService', () => ({
  generateFaction: (_prompt: string, _mock: boolean, _ctx: string | undefined, signal: AbortSignal) =>
    new Promise((resolve) => { ai.pending = { resolve, signal }; }),
  chatWithRealmWeaver: vi.fn(),
  generateEnhancedText: vi.fn(),
}));

vi.mock('@/services/campaignService', () => ({
  campaignService: {
    subscribe: () => () => {},
    getState: () => ({ campaigns: [], activeCampaignId: null }),
    getActiveCampaign: () => undefined,
  },
}));

const { FactionGenerator } = await import('@/components/generators/FactionGenerator');

function startGeneration(container: HTMLElement) {
  fireEvent.change(container.querySelector('textarea')!, { target: { value: 'A thieves guild' } });
  const generate = Array.from(container.querySelectorAll('button'))
    .find(b => /generate faction/i.test(b.textContent || ''))!;
  fireEvent.click(generate);
}

const FACTION = { name: 'Late Guild', description: 'd', goals: 'g' };

describe('FactionGenerator — cancellation (L1)', () => {
  it('unmounting mid-generation aborts the request and never creates the entity', async () => {
    const onFactionCreated = vi.fn();
    const { container, unmount } = render(
      <FactionGenerator onFactionCreated={onFactionCreated} isMockMode={false} />,
    );
    startGeneration(container);
    await waitFor(() => expect(ai.pending).not.toBeNull());
    const { signal, resolve } = ai.pending!;

    unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { resolve(FACTION); });
    expect(onFactionCreated).not.toHaveBeenCalled();
  });

  it('shows a Cancel button while loading that aborts and drops the result', async () => {
    ai.pending = null;
    const onFactionCreated = vi.fn();
    const { container, getByRole, queryByRole } = render(
      <FactionGenerator onFactionCreated={onFactionCreated} isMockMode={false} />,
    );
    expect(queryByRole('button', { name: /cancel faction generation/i })).toBeNull();
    startGeneration(container);
    await waitFor(() => expect(ai.pending).not.toBeNull());
    const { signal, resolve } = ai.pending!;

    fireEvent.click(getByRole('button', { name: /cancel faction generation/i }));
    expect(signal.aborted).toBe(true);
    await act(async () => { resolve(FACTION); });
    expect(onFactionCreated).not.toHaveBeenCalled();
    // Back to idle: the generate button is usable again, no error shown.
    expect(queryByRole('button', { name: /cancel faction generation/i })).toBeNull();
    expect(container.textContent).not.toMatch(/failed to generate/i);
  });

  it('a completed generation still creates the entity', async () => {
    ai.pending = null;
    const onFactionCreated = vi.fn();
    const { container } = render(
      <FactionGenerator onFactionCreated={onFactionCreated} isMockMode={false} />,
    );
    startGeneration(container);
    await waitFor(() => expect(ai.pending).not.toBeNull());
    await act(async () => { ai.pending!.resolve(FACTION); });
    await waitFor(() => expect(onFactionCreated).toHaveBeenCalledWith({ ...FACTION, leaderId: undefined, memberIds: [] }));
  });
});
