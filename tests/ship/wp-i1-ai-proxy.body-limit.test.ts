/**
 * wp-i1-ai-proxy — finding #89 (vite-plugin-ai-proxy.ts:293)
 *
 * `readBody` rejects once the body exceeds 4MB but it neither pauses nor
 * destroys the request stream, and it has no settled flag. The client keeps
 * uploading into a socket whose response was already written, and every
 * subsequent `data` event calls the already-settled `reject` again. The error
 * is also mapped to a generic 500 ("Request body too large (max 4MB)") rather
 * than 413, so `withRetry` cannot tell it apart from a transient failure and
 * retries the whole multi-megabyte upload.
 *
 * Contract pinned here:
 *   1. oversized body → HTTP 413 with a message naming the limit,
 *   2. the request stream is torn down (destroy, or pause + unpipe),
 *   3. exactly ONE response is written no matter how many further chunks
 *      arrive.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FakeReq, FakeRes, mountDevServer, routeFor, waitFor } from './wp-i1-ai-proxy.harness';

const h = vi.hoisted(() => {
  const state = { execFileCalls: [] as any[][] };
  const execFile: any = () => {
    throw new Error('callback-style execFile is not used by the proxy');
  };
  execFile[Symbol.for('nodejs.util.promisify.custom')] = async (
    file: string,
    args: string[],
    opts: unknown
  ) => {
    state.execFileCalls.push([file, args, opts]);
    return { stdout: 'ok', stderr: '' };
  };
  const spawn: any = () => {
    throw new Error('spawn should not be reached in these tests');
  };
  return { state, execFile, spawn };
});

vi.mock('child_process', () => ({ execFile: h.execFile, spawn: h.spawn }));

import { aiProxyPlugin } from '../../vite-plugin-ai-proxy';

beforeEach(() => {
  h.state.execFileCalls.length = 0;
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const ONE_MB = Buffer.alloc(1024 * 1024, 0x41);

describe('AI proxy request body cap — finding #89', () => {
  it('answers 413 (not 500) and tears down the stream when the body exceeds the cap', async () => {
    const handler = routeFor(mountDevServer(aiProxyPlugin()), '/api/ai/generate');
    const req = new FakeReq();
    const res = new FakeRes();

    handler(req, res);

    // A base64-embedded character sheet PDF: five 1MB chunks, over the 4MB cap.
    for (let i = 0; i < 5; i++) {
      req.emit('data', ONE_MB);
    }
    await waitFor(() => res.ended);

    expect(res.statusCode).toBe(413);
    expect(res.json().error).toMatch(/too large|payload|4\s?MB/i);
    expect(h.state.execFileCalls).toHaveLength(0);

    // The upload must be stopped rather than left streaming into a closed
    // response (destroy(), or pause() + unpipe()).
    const tornDown = req.destroy.mock.calls.length > 0 || req.pause.mock.calls.length > 0;
    expect(tornDown).toBe(true);
  });

  it('actually delivers the 413 to the client — an inert destroy() can no longer fake this', async () => {
    // Link req and res the way a real Node socket links IncomingMessage and
    // ServerResponse: FakeRes.assertSocketAlive() throws if a write happens
    // AFTER the linked req has been destroyed, exactly reproducing the real
    // bug (destroy() resets the TCP socket, so a write into it never
    // reaches the client -> ECONNRESET instead of a 413). A fix that
    // destroys the request stream before writing the response would make
    // this test throw/fail; the correct fix (pause first, destroy only
    // after the response's 'finish' event) does not.
    const handler = routeFor(mountDevServer(aiProxyPlugin()), '/api/ai/generate');
    const req = new FakeReq();
    const res = new FakeRes().attach(req);

    handler(req, res);
    for (let i = 0; i < 5; i++) {
      req.emit('data', ONE_MB);
    }
    await waitFor(() => res.ended);

    // If the response write had happened after req.destroy(), FakeRes would
    // have thrown out of the handler and res.ended would still be false.
    expect(res.ended).toBe(true);
    expect(res.statusCode).toBe(413);
    expect(res.json().error).toMatch(/too large|payload|4\s?MB/i);

    // The request stream must still eventually be torn down (just deferred
    // until after the response was flushed), so the socket doesn't leak.
    await waitFor(() => req.destroyed);
    expect(req.destroyed).toBe(true);
  });

  it('writes exactly one response even if further chunks keep arriving', async () => {
    const handler = routeFor(mountDevServer(aiProxyPlugin()), '/api/ai/generate');
    const req = new FakeReq();
    const res = new FakeRes();

    handler(req, res);
    for (let i = 0; i < 5; i++) {
      req.emit('data', ONE_MB);
    }
    await waitFor(() => res.ended);

    // Client is still uploading; the browser has not noticed the response yet.
    expect(() => {
      req.emit('data', ONE_MB);
      req.emit('data', ONE_MB);
      req.emit('end');
    }).not.toThrow();
    await waitFor(() => res.endCount > 1, 100);

    expect(res.writeHeadCount).toBe(1);
    expect(res.endCount).toBe(1);
    expect(res.statusCode).toBe(413);
  });
});
