/**
 * wp-i1-ai-proxy — finding #87 (vite-plugin-ai-proxy.ts:1)
 *
 * "No tests at all for vite-plugin-ai-proxy.ts, the only server-side code in
 * the product." The remedy for this finding IS a test suite, so — unlike the
 * other files in this work package — these tests are expected to PASS against
 * the current code. They characterise the behaviour that must not regress
 * while the other five findings are fixed:
 *
 *   405 on GET · 403 on a foreign Origin · 400 on a missing prompt ·
 *   argv construction for the subprocess · envelope unwrapping ·
 *   `is_error: true` propagation · timeout → 504 + code ETIMEDOUT (both the
 *   execFile and the spawn path) · ENOENT → install hint · health endpoint.
 *
 * The oversized-stdout and oversized-body assertions the finding also asks for
 * live in wp-i1-ai-proxy.stdout-limit.test.ts and
 * wp-i1-ai-proxy.body-limit.test.ts, since those are red today.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FakeChild,
  FakeReq,
  FakeRes,
  authorizedHeaders,
  mountDevServer,
  routeFor,
  waitFor,
} from './wp-i1-ai-proxy.harness';

const h = vi.hoisted(() => {
  const state = {
    execArgs: [] as any[][],
    execResult: { stdout: 'plain text', stderr: '' } as { stdout: string; stderr: string },
    execError: null as any,
    child: null as any,
    spawnArgs: [] as any[][],
  };
  const execFile: any = () => {
    throw new Error('callback-style execFile is not used by the proxy');
  };
  execFile[Symbol.for('nodejs.util.promisify.custom')] = async (
    file: string,
    args: string[],
    opts: unknown
  ) => {
    state.execArgs.push([file, args, opts]);
    if (state.execError) throw state.execError;
    return state.execResult;
  };
  const spawn: any = (...args: any[]) => {
    state.spawnArgs.push(args);
    return state.child;
  };
  return { state, execFile, spawn };
});

vi.mock('child_process', () => ({ execFile: h.execFile, spawn: h.spawn }));

import { aiProxyPlugin } from '../../vite-plugin-ai-proxy';

beforeEach(() => {
  h.state.execArgs.length = 0;
  h.state.spawnArgs.length = 0;
  h.state.execError = null;
  h.state.execResult = { stdout: 'plain text', stderr: '' };
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function generateHandler() {
  return routeFor(mountDevServer(aiProxyPlugin()), '/api/ai/generate');
}

function post(body: unknown, headers = authorizedHeaders()) {
  const req = new FakeReq({ headers });
  const res = new FakeRes();
  generateHandler()(req, res);
  req.sendJson(body);
  return res;
}

describe('AI proxy — request validation', () => {
  it('answers 405 to a GET', () => {
    const req = new FakeReq({ method: 'GET' });
    const res = new FakeRes();
    generateHandler()(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.json().error).toMatch(/not allowed/i);
  });

  it('answers 403 to a foreign Origin and never spawns the CLI', async () => {
    const res = post(
      { prompt: 'exfiltrate' },
      { ...authorizedHeaders(), origin: 'https://evil.example' }
    );
    await waitFor(() => res.ended);

    expect(res.statusCode).toBe(403);
    expect(h.state.execArgs).toHaveLength(0);
    expect(h.state.spawnArgs).toHaveLength(0);
  });

  it('answers 400 when prompt is missing', async () => {
    const res = post({ model: 'sonnet' });
    await waitFor(() => res.ended);

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/prompt/i);
    expect(h.state.execArgs).toHaveLength(0);
  });

  it('does not invoke the CLI for an unparseable body', async () => {
    const req = new FakeReq();
    const res = new FakeRes();
    generateHandler()(req, res);
    req.emit('data', Buffer.from('not json at all'));
    req.emit('end');
    await waitFor(() => res.ended);

    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(h.state.execArgs).toHaveLength(0);
  });
});

describe('AI proxy — subprocess invocation', () => {
  it('builds the CLI argv from the request without a shell', async () => {
    h.state.execResult = { stdout: 'ok', stderr: '' };
    const res = post({
      prompt: 'Describe a tavern',
      model: 'opus',
      outputFormat: 'json',
      systemPrompt: 'You are a GM assistant.',
      maxTurns: 3,
    });
    await waitFor(() => res.ended);

    expect(h.state.execArgs).toHaveLength(1);
    const [, args] = h.state.execArgs[0];
    expect(args).toEqual([
      '--print',
      '--model',
      'opus',
      '--output-format',
      'json',
      '--system-prompt',
      'You are a GM assistant.',
      '--max-turns',
      '3',
      '-p',
      'Describe a tavern',
    ]);
  });

  it('pipes prompts over 100KB through stdin instead of argv', async () => {
    const child = new FakeChild();
    h.state.child = child;
    const huge = 'A'.repeat(120_000);

    const res = post({ prompt: huge, outputFormat: 'json' });
    await waitFor(() => h.state.spawnArgs.length > 0);

    const [, args] = h.state.spawnArgs[0];
    expect(args).toContain('-p');
    expect(args[args.length - 1]).toBe('-');
    expect(args).not.toContain(huge);

    await waitFor(() => child.stdin.write.mock.calls.length > 0);
    expect(child.stdin.writes.join('')).toBe(huge);

    child.stdout.emit('data', Buffer.from('{"type":"result","result":"done","is_error":false}'));
    child.emit('close', 0, null);
    await waitFor(() => res.ended);
    expect(res.statusCode).toBe(200);
    expect(res.json().result).toBe('done');
  });
});

describe('AI proxy — CLI result envelope', () => {
  it('unwraps the inner result field', async () => {
    h.state.execResult = {
      stdout: '{"type":"result","result":"An amber-lit tavern.","is_error":false}',
      stderr: '',
    };
    const res = post({ prompt: 'tavern', outputFormat: 'json' });
    await waitFor(() => res.ended);

    expect(res.statusCode).toBe(200);
    expect(res.json().result).toBe('An amber-lit tavern.');
  });

  it('propagates an is_error envelope as a failure, whatever its message text', async () => {
    h.state.execResult = {
      stdout: '{"type":"result","result":"Credit balance too low","is_error":true}',
      stderr: '',
    };
    const res = post({ prompt: 'tavern', outputFormat: 'json' });
    await waitFor(() => res.ended);

    expect(res.statusCode).toBeGreaterThanOrEqual(500);
    expect(res.json().error).toMatch(/Credit balance too low/);
  });
});

describe('AI proxy — error mapping', () => {
  it('maps an execFile timeout (killed, no code) to 504 with code ETIMEDOUT', async () => {
    h.state.execError = Object.assign(new Error('Command failed'), { killed: true });
    const res = post({ prompt: 'tavern' });
    await waitFor(() => res.ended);

    expect(res.statusCode).toBe(504);
    expect(res.json().code).toBe('ETIMEDOUT');
    expect(res.json().error).toMatch(/timed out/i);
  });

  it('maps a spawn-path SIGTERM timeout to 504 with code ETIMEDOUT', async () => {
    const child = new FakeChild();
    h.state.child = child;
    const res = post({ prompt: 'A'.repeat(120_000) });
    await waitFor(() => child.stdin.end.mock.calls.length > 0);

    child.emit('close', null, 'SIGTERM');
    await waitFor(() => res.ended);

    expect(res.statusCode).toBe(504);
    expect(res.json().code).toBe('ETIMEDOUT');
  });

  it('turns ENOENT into an actionable install hint', async () => {
    h.state.execError = Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' });
    const res = post({ prompt: 'tavern' });
    await waitFor(() => res.ended);

    expect(res.statusCode).toBe(500);
    expect(res.json().error).toMatch(/CLAUDE_CLI_PATH/);
  });
});

describe('AI proxy — health endpoint', () => {
  it('reports the configured provider and CLI path', () => {
    const handler = routeFor(mountDevServer(aiProxyPlugin()), '/api/ai/health');
    const req = new FakeReq({ method: 'GET', url: '/api/ai/health' });
    const res = new FakeRes();
    handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', provider: 'claude-cli' });
  });
});
