/**
 * wp-i1-ai-proxy — finding #32 (vite-plugin-ai-proxy.ts:211)
 *
 * In the spawn (large-prompt) path, `if (totalBytes <= MAX_BUFFER)` silently
 * DROPS every stdout chunk past 1MB, yet the child still exits 0 and the
 * truncated buffer is resolved as success. The truncated string is a partial
 * `{"type":"result","result":"…` envelope, so JSON.parse throws a plain
 * SyntaxError which the catch at line 122 deliberately swallows (it only
 * rethrows CliEnvelopeError), and the endpoint answers 200 with the mangled
 * JSON blob as the AI "content" — which for generateText goes straight into
 * the campaign and gets auto-saved to localStorage.
 *
 * Note the inconsistency the fix must remove: the execFile path under the same
 * MAX_BUFFER correctly errors with ENOBUFS, so the failure mode currently
 * changes based on prompt size.
 *
 * Contract pinned here:
 *   1. stdout past MAX_BUFFER → kill the child and fail the request (no 200,
 *      no truncated content), matching the execFile/ENOBUFS behaviour,
 *   2. when `outputFormat: 'json'` was requested and the output does not parse
 *      as an envelope, respond 502 instead of passing raw text through,
 *   3. non-JSON output formats still pass through untouched.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FakeChild, FakeReq, FakeRes, mountDevServer, routeFor, waitFor } from './wp-i1-ai-proxy.harness';

const h = vi.hoisted(() => {
  const state = {
    child: null as any,
    execStdout: '',
    execCalls: 0,
  };
  const execFile: any = () => {
    throw new Error('callback-style execFile is not used by the proxy');
  };
  execFile[Symbol.for('nodejs.util.promisify.custom')] = async () => {
    state.execCalls += 1;
    return { stdout: state.execStdout, stderr: '' };
  };
  const spawn: any = () => state.child;
  return { state, execFile, spawn };
});

vi.mock('child_process', () => ({ execFile: h.execFile, spawn: h.spawn }));

import { aiProxyPlugin } from '../../vite-plugin-ai-proxy';

const HUGE_PROMPT = 'A'.repeat(120_000); // > DIRECT_PROMPT_LIMIT → spawn path

beforeEach(() => {
  h.state.execCalls = 0;
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function post(body: unknown) {
  const handler = routeFor(mountDevServer(aiProxyPlugin()), '/api/ai/generate');
  const req = new FakeReq();
  const res = new FakeRes();
  handler(req, res);
  req.sendJson(body);
  return res;
}

describe('AI proxy stdout buffer limit — finding #32', () => {
  it('fails the request instead of returning silently truncated CLI output', async () => {
    const child = new FakeChild();
    h.state.child = child;

    const res = post({ prompt: HUGE_PROMPT, outputFormat: 'json' });
    await waitFor(() => child.stdin.write.mock.calls.length > 0);

    // 1.4MB of stdout — past the 1MB MAX_BUFFER.
    const head = '{"type":"result","is_error":false,"result":"';
    child.stdout.emit('data', Buffer.from(head + 'x'.repeat(700_000)));
    child.stdout.emit('data', Buffer.from('y'.repeat(700_000) + '"}'));

    await waitFor(() => res.ended, 150);
    if (!res.ended) {
      // Current code only settles on close; a correct fix rejects earlier.
      child.emit('close', 0, null);
      await waitFor(() => res.ended);
    }

    expect(res.ended).toBe(true);
    expect(res.statusCode).not.toBe(200);
    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    expect(res.json().result).toBeUndefined();
    expect(String(res.json().error)).toMatch(/ENOBUFS|buffer|too large|exceed/i);
    expect(child.kill).toHaveBeenCalled();
  });

  it('returns 502 when json output was requested but the CLI output does not parse', async () => {
    // Truncated / non-envelope output from the execFile path.
    h.state.execStdout = '{"type":"result","result":"{\\"npcs\\":[';

    const res = post({ prompt: 'Generate five NPCs', outputFormat: 'json' });
    await waitFor(() => res.ended);

    expect(h.state.execCalls).toBe(1);
    expect(res.statusCode).toBe(502);
    expect(res.json().result).toBeUndefined();
  });

  it('still passes plain-text output through untouched when json was not requested', async () => {
    h.state.execStdout = 'The tavern smells of woodsmoke and spilled ale.';

    const res = post({ prompt: 'Describe a tavern' });
    await waitFor(() => res.ended);

    expect(res.statusCode).toBe(200);
    expect(res.json().result).toBe('The tavern smells of woodsmoke and spilled ale.');
  });
});
