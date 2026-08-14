/**
 * wp-i1-ai-proxy — finding #31 (vite-plugin-ai-proxy.ts:246)
 *
 * In the >100KB prompt branch `child.stdin.write(request.prompt)` runs with no
 * 'error' listener on the pipe. `child.on('error')` only covers spawn failures
 * on the ChildProcess, not write failures on stdin. When the child dies early
 * (bad CLAUDE_CLI_PATH, expired auth) the pending write emits
 * EPIPE / ERR_STREAM_DESTROYED on a stream with no error handler, and node
 * escalates that to an uncaught exception — which kills the Vite server, i.e.
 * the whole app runtime, mid-session.
 *
 * Only prompts over 100KB reach this branch (base64 PDF imports do), which is
 * why it survives casual testing.
 *
 * Contract pinned here:
 *   1. an 'error' listener is attached to child.stdin BEFORE the write,
 *   2. a pipe error rejects the request → JSON error response, no uncaught
 *      exception,
 *   3. a destroyed stdin is not written to at all.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FakeChild, FakeReq, FakeRes, mountDevServer, routeFor, waitFor } from './wp-i1-ai-proxy.harness';

const h = vi.hoisted(() => {
  const state = {
    child: null as any,
    spawnCalls: [] as any[][],
  };
  const execFile: any = () => {
    throw new Error('callback-style execFile is not used by the proxy');
  };
  execFile[Symbol.for('nodejs.util.promisify.custom')] = async () => {
    throw new Error('execFile path should not be used for >100KB prompts');
  };
  const spawn: any = (...args: any[]) => {
    state.spawnCalls.push(args);
    return state.child;
  };
  return { state, execFile, spawn };
});

vi.mock('child_process', () => ({ execFile: h.execFile, spawn: h.spawn }));

import { aiProxyPlugin } from '../../vite-plugin-ai-proxy';

// Over DIRECT_PROMPT_LIMIT (100KB), so invokeClaudeCli takes the spawn/stdin path.
const HUGE_PROMPT = 'A'.repeat(120_000);

beforeEach(() => {
  h.state.spawnCalls.length = 0;
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AI proxy stdin error handling — finding #31', () => {
  it('attaches an error handler to stdin before writing, and turns EPIPE into an error response', async () => {
    const child = new FakeChild();
    const epipe = Object.assign(new Error('write EPIPE'), { code: 'EPIPE' });
    child.stdin.failWith = epipe;
    h.state.child = child;

    const handler = routeFor(mountDevServer(aiProxyPlugin()), '/api/ai/generate');
    const req = new FakeReq();
    const res = new FakeRes();

    handler(req, res);
    req.sendJson({ prompt: HUGE_PROMPT, outputFormat: 'json', model: 'sonnet' });

    await waitFor(() => child.stdin.write.mock.calls.length > 0);
    expect(h.state.spawnCalls).toHaveLength(1);

    // The listener must exist at write() time — attaching it afterwards still
    // loses a synchronously-emitted error.
    expect(child.stdin.hadErrorListenerAtWrite).toBe(true);

    await waitFor(() => res.ended);
    expect(child.stdin.unhandledError).toBe(false);
    expect(res.ended).toBe(true);
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    expect(res.json().error).toMatch(/EPIPE|pipe|stdin|write/i);
  });

  it('does not write to a stdin pipe that is already destroyed', async () => {
    const child = new FakeChild();
    child.stdin.destroyed = true;
    h.state.child = child;

    const handler = routeFor(mountDevServer(aiProxyPlugin()), '/api/ai/generate');
    const req = new FakeReq();
    const res = new FakeRes();

    handler(req, res);
    req.sendJson({ prompt: HUGE_PROMPT, outputFormat: 'json' });

    await waitFor(() => h.state.spawnCalls.length > 0);
    await waitFor(() => child.stdin.write.mock.calls.length > 0, 100);

    expect(child.stdin.write).not.toHaveBeenCalled();
  });
});
