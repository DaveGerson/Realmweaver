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
 *
 * Contract changes since, pinned here (finding C1 + P5):
 *   - C1: the argv shape this file originally pinned (`... -p <prompt>`) was
 *     itself the defect — `-p` is an alias of `--print` (a boolean flag, not
 *     a prompt flag), so the prompt was a bare positional and any prompt
 *     starting with `-` (bulleted session notes, `---` YAML front matter)
 *     aborted the CLI with `error: unknown option`. The prompt now travels
 *     after a `--` separator on both the execFile and spawn paths.
 *   - C1 (error hygiene): a non-zero execFile exit rejects with Node's
 *     `Command failed: <full argv>\n<stderr>` — the argv embeds the whole
 *     --system-prompt (campaign context) and prompt, which must never be
 *     echoed back to the client; only the CLI's stderr tail may be.
 *   - P5: REALMWEAVER_TIMEOUT_MS was parsed but never consumed — the real
 *     deadline was a hardcoded 120s. The proxy now resolves it live from
 *     process.env for the execFile/spawn timeouts and derives the
 *     "timed out after N seconds" copy from the same value.
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
      '--',
      'Describe a tavern',
    ]);
  });

  it('passes a dash-leading prompt as the operand after `--`, never as an option (C1)', async () => {
    h.state.execResult = { stdout: 'ok', stderr: '' };
    const prompt = '- bullet notes\n- found a map to the crypt';
    const res = post({ prompt, model: 'sonnet' });
    await waitFor(() => res.ended);

    expect(h.state.execArgs).toHaveLength(1);
    const [, args] = h.state.execArgs[0];
    // The `--` terminator must sit immediately before the prompt, so the
    // CLI's option parser can never read `- bullet notes…` as an option.
    expect(args[args.length - 2]).toBe('--');
    expect(args[args.length - 1]).toBe(prompt);
    // `-p` is an alias of `--print` (already emitted), not a prompt flag.
    expect(args).not.toContain('-p');
    expect(res.statusCode).toBe(200);
  });

  it('pipes prompts over 100KB through stdin instead of argv', async () => {
    const child = new FakeChild();
    h.state.child = child;
    const huge = 'A'.repeat(120_000);

    const res = post({ prompt: huge, outputFormat: 'json' });
    await waitFor(() => h.state.spawnArgs.length > 0);

    const [, args] = h.state.spawnArgs[0];
    // The stdin placeholder `-` is an operand either way, but it rides after
    // the same `--` separator as the direct path for symmetry (C1).
    expect(args[args.length - 2]).toBe('--');
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

  it('never echoes the execFile argv (system prompt + prompt) back to the client — C1 hygiene', async () => {
    const systemPrompt = 'CAMPAIGN-CONTEXT-MUST-NOT-LEAK';
    // Node's execFile rejection for a non-zero exit: `Command failed: <full
    // argv>\n<stderr>`, with the raw stderr also attached as a property.
    h.state.execError = Object.assign(
      new Error(
        `Command failed: claude --print --system-prompt ${systemPrompt} -- a prompt\nInvalid API key`
      ),
      { code: 1, stderr: 'Invalid API key' }
    );
    const res = post({ prompt: 'a prompt', systemPrompt });
    await waitFor(() => res.ended);

    expect(res.statusCode).toBe(500);
    const message = String(res.json().error);
    expect(message).not.toContain(systemPrompt);
    expect(message).not.toContain('Command failed');
    expect(message).toContain('Invalid API key');
  });

  it('falls back to a generic message when a Command-failed error carries no stderr', async () => {
    h.state.execError = Object.assign(
      new Error('Command failed: claude --print --system-prompt SECRET -- p'),
      { code: 1, stderr: '' }
    );
    const res = post({ prompt: 'p' });
    await waitFor(() => res.ended);

    expect(res.statusCode).toBe(500);
    const message = String(res.json().error);
    expect(message).not.toContain('SECRET');
    expect(message).toMatch(/exited with an error/i);
  });
});

describe('AI proxy — REALMWEAVER_TIMEOUT_MS wiring (P5)', () => {
  const ORIGINAL_TIMEOUT = process.env.REALMWEAVER_TIMEOUT_MS;

  afterEach(() => {
    if (ORIGINAL_TIMEOUT === undefined) delete process.env.REALMWEAVER_TIMEOUT_MS;
    else process.env.REALMWEAVER_TIMEOUT_MS = ORIGINAL_TIMEOUT;
  });

  it('defaults the execFile timeout to 120000ms when the env var is unset', async () => {
    delete process.env.REALMWEAVER_TIMEOUT_MS;
    const res = post({ prompt: 'tavern' });
    await waitFor(() => res.ended);

    const [, , opts] = h.state.execArgs[0];
    expect((opts as { timeout?: number }).timeout).toBe(120_000);
  });

  it('uses the configured timeout for execFile and derives the timed-out copy from it', async () => {
    process.env.REALMWEAVER_TIMEOUT_MS = '300000';
    h.state.execError = Object.assign(new Error('Command failed'), { killed: true });
    const res = post({ prompt: 'tavern' });
    await waitFor(() => res.ended);

    const [, , opts] = h.state.execArgs[0];
    expect((opts as { timeout?: number }).timeout).toBe(300_000);
    expect(res.statusCode).toBe(504);
    expect(res.json().error).toMatch(/timed out after 300 seconds/);
  });

  it('passes the configured timeout to the spawn path too', async () => {
    process.env.REALMWEAVER_TIMEOUT_MS = '45000';
    const child = new FakeChild();
    h.state.child = child;
    const res = post({ prompt: 'A'.repeat(120_000) });
    await waitFor(() => h.state.spawnArgs.length > 0);

    const [, , opts] = h.state.spawnArgs[0];
    expect((opts as { timeout?: number }).timeout).toBe(45_000);
    // Settle the in-flight request so nothing leaks into the next test.
    child.stdout.emit('data', Buffer.from('done'));
    child.emit('close', 0, null);
    await waitFor(() => res.ended);
  });
});

describe('AI proxy — health endpoint', () => {
  it('reports the configured provider for a legitimate local request', () => {
    const handler = routeFor(mountDevServer(aiProxyPlugin()), '/api/ai/health');
    const req = new FakeReq({ method: 'GET', url: '/api/ai/health' });
    const res = new FakeRes();
    handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', provider: 'claude-cli' });
  });

  it('does not disclose CLAUDE_CLI_PATH in the response body', () => {
    const handler = routeFor(mountDevServer(aiProxyPlugin()), '/api/ai/health');
    const req = new FakeReq({ method: 'GET', url: '/api/ai/health' });
    const res = new FakeRes();
    handler(req, res);

    expect(res.json()).not.toHaveProperty('cli');
  });

  it('gates the health endpoint the same way as /api/ai/generate — finding #30 minor', () => {
    const handler = routeFor(mountDevServer(aiProxyPlugin()), '/api/ai/health');

    // Forged Origin/Host from a real LAN peer, mirroring the #30 repro.
    const req = new FakeReq({
      method: 'GET',
      url: '/api/ai/health',
      headers: authorizedHeaders(),
      socket: { remoteAddress: '192.0.2.2' },
    });
    const res = new FakeRes();
    handler(req, res);

    expect(res.statusCode).toBe(403);
  });
});
