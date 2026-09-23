/**
 * wp-i1-ai-proxy — roadmap L1 (client-disconnect cancellation)
 *
 * The SPA now aborts `/api/ai/generate` fetches (generator unmount, Cancel
 * button). Before this, the proxy had no idea: the spawned `claude` process
 * ran to completion (up to REALMWEAVER_TIMEOUT_MS) for a response nobody would
 * read, burning subscription quota and CPU.
 *
 * Contract pinned here:
 *   1. spawn path (>100KB prompt): the response closing before it finished
 *      kills the child and writes nothing to the dead socket;
 *   2. execFile path: the child is started with an AbortSignal that fires on
 *      the same early close (Node kills the process on abort);
 *   3. a normal response's own 'close' (after 'finish') never kills anything.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FakeChild, FakeReq, FakeRes, mountDevServer, routeFor, waitFor } from './wp-i1-ai-proxy.harness';

const h = vi.hoisted(() => {
  const state = {
    child: null as any,
    execOptions: [] as any[],
    execResolve: null as null | ((v: { stdout: string }) => void),
  };
  const execFile: any = () => {
    throw new Error('callback-style execFile is not used by the proxy');
  };
  execFile[Symbol.for('nodejs.util.promisify.custom')] = (_cmd: string, _args: string[], options: any) => {
    state.execOptions.push(options);
    return new Promise((resolve, reject) => {
      state.execResolve = resolve;
      options?.signal?.addEventListener('abort', () => {
        reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError', code: 'ABORT_ERR' }));
      });
    });
  };
  const spawn: any = () => state.child;
  return { state, execFile, spawn };
});

vi.mock('child_process', () => ({ execFile: h.execFile, spawn: h.spawn }));

import { aiProxyPlugin } from '../../vite-plugin-ai-proxy';

const HUGE_PROMPT = 'A'.repeat(120_000);

beforeEach(() => {
  h.state.execOptions.length = 0;
  h.state.execResolve = null;
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AI proxy — client abort kills the claude CLI child (L1)', () => {
  it('spawn path: kills the child when the client disconnects mid-request', async () => {
    const child = new FakeChild();
    h.state.child = child;
    const handler = routeFor(mountDevServer(aiProxyPlugin()), '/api/ai/generate');
    const req = new FakeReq();
    const res = new FakeRes();

    handler(req, res);
    req.sendJson({ prompt: HUGE_PROMPT, outputFormat: 'json', model: 'sonnet' });
    await waitFor(() => child.stdin.write.mock.calls.length > 0);

    // Browser aborted its fetch: the connection closes before we responded.
    res.emit('close');
    expect(child.kill).toHaveBeenCalledTimes(1);

    // The child then exits due to the signal; nothing is written back.
    child.emit('close', null, 'SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(res.writeHeadCount).toBe(0);
    expect(res.endCount).toBe(0);
  });

  it('execFile path: passes an AbortSignal that fires on early client close', async () => {
    const handler = routeFor(mountDevServer(aiProxyPlugin()), '/api/ai/generate');
    const req = new FakeReq();
    const res = new FakeRes();

    handler(req, res);
    req.sendJson({ prompt: 'short prompt', outputFormat: 'text', model: 'haiku' });
    await waitFor(() => h.state.execOptions.length > 0);

    const signal: AbortSignal = h.state.execOptions[0].signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);

    res.emit('close');
    expect(signal.aborted).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(res.endCount).toBe(0);
  });

  it('a normal completed response does not abort anything on its trailing close', async () => {
    const handler = routeFor(mountDevServer(aiProxyPlugin()), '/api/ai/generate');
    const req = new FakeReq();
    const res = new FakeRes();

    handler(req, res);
    req.sendJson({ prompt: 'short prompt', outputFormat: 'text', model: 'haiku' });
    await waitFor(() => h.state.execResolve !== null);
    const signal: AbortSignal = h.state.execOptions[0].signal;

    h.state.execResolve!({ stdout: 'hello' });
    await waitFor(() => res.ended);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ result: 'hello' });

    res.emit('close');
    expect(signal.aborted).toBe(false);
  });
});
