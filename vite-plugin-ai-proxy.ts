/**
 * vite-plugin-ai-proxy.ts
 *
 * Vite dev server middleware plugin that bridges the browser SPA with the
 * local Claude CLI binary. Since Realmweaver is a local-first app where
 * `npm run dev` IS the production runtime, this plugin adds API routes
 * directly to the Vite dev server -- no separate Express process needed.
 *
 * Endpoints:
 *   POST /api/ai/generate  - Invoke Claude CLI with a prompt
 *   GET  /api/ai/health    - Health check
 *
 * Security: Uses `execFile` (no shell) for CLI invocation to prevent
 * command injection. For prompts exceeding 100KB, falls back to a temp
 * file approach with shell invocation (necessary to bypass ARG_MAX).
 */

import type { Plugin, ViteDevServer } from 'vite';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';


const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CLAUDE_CLI_PATH = process.env.CLAUDE_CLI_PATH || 'claude';
const TIMEOUT_MS = 120_000;
const MAX_BUFFER = 1024 * 1024; // 1MB output buffer
const DIRECT_PROMPT_LIMIT = 100_000; // 100KB -- above this, use temp file

// Same-origin allowlist for the local dev/runtime server. Only requests whose
// Origin resolves to localhost/127.0.0.1/[::1] are allowed to invoke the CLI
// -- this blocks DNS-rebinding / cross-origin pages (and other LAN hosts, in
// combination with the `server.host` default in vite.config.ts) from
// silently spending the user's Claude usage.
const ALLOWED_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

// Matches only the hostname portion (no scheme, no port) of a Host header --
// used to detect a request that arrived over a LAN bind
// (REALMWEAVER_DEV_HOST=0.0.0.0 / `vite --host`) even when the Origin header
// has been forged or omitted by a non-browser client.
const ALLOWED_HOST_RE = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/i;

/**
 * Returns true when the request's Origin AND Host both resolve to a
 * localhost interface. Origin is trivially forged (or simply absent) by
 * non-browser clients like curl/python, so it alone is not sufficient
 * authentication -- Host reflects the interface the connection actually
 * arrived on, which is what reveals a LAN bind.
 */
function isLocalRequest(headers: Record<string, string | string[] | undefined>): boolean {
  const origin = headers.origin;
  if (typeof origin !== 'string' || !origin || !ALLOWED_ORIGIN_RE.test(origin)) {
    return false;
  }

  const hostHeader = headers.host;
  if (typeof hostHeader !== 'string' || !hostHeader) {
    return false;
  }
  // Strip a trailing ":<port>", but leave IPv6 brackets intact.
  const hostname = hostHeader.replace(/:\d+$/, '');
  return ALLOWED_HOST_RE.test(hostname);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CliRequest {
  prompt: string;
  model?: string;
  outputFormat?: string;
  systemPrompt?: string;
  maxTurns?: number;
}

/**
 * Thrown when the Claude CLI itself reports failure via its JSON result
 * envelope (`is_error: true`). Kept as a distinct class -- rather than a
 * hardcoded string comparison -- so the outer catch can reliably tell "the
 * CLI reported an error" apart from "this output wasn't a JSON envelope at
 * all", regardless of what message text the CLI happened to return.
 */
class CliEnvelopeError extends Error {}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

/**
 * Minimal shape both `configureServer` (dev) and `configurePreviewServer`
 * (preview) hand the plugin -- a connect-style middleware stack with `.use`.
 * Registering routes through this single function keeps `vite preview`
 * (which serves the built `dist/`) behaving identically to `vite dev`
 * instead of 404ing on every AI call, since Vite only invokes
 * `configureServer` for the dev server.
 */
interface MiddlewareServer {
  middlewares: { use: ViteDevServer['middlewares']['use'] };
}

function registerAiRoutes(server: MiddlewareServer) {
  // Health check endpoint
  server.middlewares.use('/api/ai/health', (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', provider: 'claude-cli', cli: CLAUDE_CLI_PATH }));
  });

  // Main AI generation endpoint
  server.middlewares.use('/api/ai/generate', (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    // Reject any request that doesn't prove it's a same-origin browser
    // request from the SPA. Non-browser clients (curl, scripts) never
    // send an Origin header, so a missing/empty Origin is treated as
    // untrusted rather than allowed through; the Host header is checked
    // too since Origin is trivially forged and Host is what reveals a
    // LAN bind (REALMWEAVER_DEV_HOST=0.0.0.0 / `vite --host`).
    if (!isLocalRequest(req.headers)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Origin not allowed' }));
      return;
    }

    readBody(req)
      .then(body => {
        const request: CliRequest = JSON.parse(body);

        if (!request.prompt) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing required field: prompt' }));
          return;
        }

        const startTime = Date.now();

        return invokeClaudeCli(request).then(rawOutput => {
          const elapsed = Date.now() - startTime;

          // Claude CLI with --output-format json returns a result envelope:
          // { type: "result", result: "actual content string", is_error: false, ... }
          // We need to extract the inner `result` field.
          let result = rawOutput;
          try {
            const envelope = JSON.parse(rawOutput);
            if (envelope && typeof envelope === 'object' && 'result' in envelope) {
              if (envelope.is_error) {
                throw new CliEnvelopeError(envelope.result || 'Claude CLI returned an error');
              }
              result = envelope.result;
            }
          } catch (parseErr) {
            // Always propagate a CLI-reported error, regardless of what
            // message text it carries.
            if (parseErr instanceof CliEnvelopeError) {
              throw parseErr;
            }
            // A genuine JSON.parse failure when the caller explicitly
            // requested `--output-format json` means the CLI's envelope
            // is missing or malformed (e.g. truncated output) -- surface
            // that as a clear upstream error instead of silently passing
            // the broken JSON blob through as if it were valid content.
            // When json wasn't requested, the raw text output IS the
            // expected content, so fall through and use it as-is.
            if (request.outputFormat === 'json') {
              const badEnvelopeErr = new Error(
                'Claude CLI returned output that could not be parsed as a JSON result envelope'
              ) as Error & { status?: number };
              badEnvelopeErr.status = 502;
              throw badEnvelopeErr;
            }
          }

          console.info(
            `[ai-proxy] ${request.model || 'default'} ${request.outputFormat || 'text'} completed in ${elapsed}ms (${result.length} chars)`
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ result }));
        });
      })
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        // Node's execFile/spawn `timeout` option kills the process with
        // SIGTERM and sets `.killed = true` on the resulting error, but
        // does NOT set `.code` to 'ETIMEDOUT' and does NOT put the word
        // "timeout" in `.message` -- so those two checks alone never
        // catch a real CLI timeout. `.killed` (execFile path) and the
        // synthetic ETIMEDOUT code set in invokeClaudeCli's spawn path
        // are the reliable signals.
        const rawCode = (err as { code?: string }).code;
        const killed = (err as { killed?: boolean }).killed === true;
        const isTimeout = killed ||
          rawCode === 'ETIMEDOUT' ||
          error.message.includes('timeout') ||
          error.message.includes('ETIMEDOUT');
        const code = isTimeout ? 'ETIMEDOUT' : rawCode;
        // An explicit `.status` on the error (e.g. the 413 body-too-large
        // case, or a 502 unparseable-JSON envelope) always wins over the
        // generic timeout/failure mapping below.
        const explicitStatus = (err as { status?: number }).status;
        const status = explicitStatus ?? (isTimeout ? 504 : 500);

        console.error(`[ai-proxy] Error (${status}):`, error.message);

        // Handle case where headers already sent
        if (!res.headersSent) {
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            error: formatErrorMessage(error, code),
            code: code,
          }));
        }
      });
  });
}

export function aiProxyPlugin(): Plugin {
  return {
    name: 'realmweaver-ai-proxy',
    configureServer(server: ViteDevServer) {
      registerAiRoutes(server);
    },
    // `vite dev` runs `configureServer`; `vite preview` (serving the built
    // `dist/`) runs this separate hook instead. Without it every AI call in
    // a previewed/production build 404s -- see finding #6. `npm run dev`
    // remains the primary supported runtime (documented in README/CLAUDE.md);
    // this hook makes `vite preview` a faithful smoke-test of the built
    // artifact rather than a dead end.
    configurePreviewServer(server: MiddlewareServer) {
      registerAiRoutes(server);
    },
  };
}

// ---------------------------------------------------------------------------
// CLI invocation
// ---------------------------------------------------------------------------

/**
 * Invokes the Claude CLI binary with the given request parameters.
 *
 * For prompts under DIRECT_PROMPT_LIMIT (100KB), the prompt is passed
 * directly via the `-p` argument to `execFile` (no shell, safe from injection).
 *
 * For larger prompts, the prompt is piped via stdin to avoid ARG_MAX limits.
 * Both paths use execFile/spawn (no shell) to prevent command injection.
 */
async function invokeClaudeCli(request: CliRequest): Promise<string> {
  const args = buildCliArgs(request);

  if (request.prompt.length <= DIRECT_PROMPT_LIMIT) {
    // Direct invocation: no shell, safe from injection
    args.push('-p', request.prompt);
    const { stdout } = await execFileAsync(CLAUDE_CLI_PATH, args, {
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
    });
    return stdout;
  } else {
    // Large prompt: pipe via stdin using spawn (no shell, no temp file)
    return new Promise<string>((resolve, reject) => {
      const child = spawn(CLAUDE_CLI_PATH, [...args, '-p', '-'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: TIMEOUT_MS,
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let totalBytes = 0;
      // Several event sources below (stdout overflow, stdin error, child
      // error, close) can each try to settle this promise; a flag keeps the
      // first one authoritative instead of a silently-ignored double
      // resolve/reject.
      let settled = false;

      const settleResolve = (value: string) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const settleReject = (err: Error) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      child.stdout.on('data', (chunk: Buffer) => {
        if (settled) return;
        totalBytes += chunk.length;
        if (totalBytes > MAX_BUFFER) {
          // Match the execFile path's ENOBUFS behaviour instead of silently
          // truncating stdout and returning the mangled JSON as if it were
          // valid content.
          const overflowErr = new Error(
            `claude CLI output exceeded the ${MAX_BUFFER}-byte buffer limit`
          ) as Error & { code?: string };
          overflowErr.code = 'ENOBUFS';
          child.kill();
          settleReject(overflowErr);
          return;
        }
        stdoutChunks.push(chunk);
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });

      child.on('error', (err) => {
        settleReject(new Error(`Failed to start claude subprocess: ${err.message}`));
      });

      child.on('close', (code, signal) => {
        if (settled) return;
        const stdout = Buffer.concat(stdoutChunks).toString();
        if (code === 0) {
          settleResolve(stdout);
        } else if (signal === 'SIGTERM' && code === null) {
          // spawn's `timeout` option kills the child with SIGTERM (the
          // default killSignal) once TIMEOUT_MS elapses, leaving `code`
          // null. Mark this distinctly so callers can detect a real timeout
          // instead of a generic non-zero exit.
          const timeoutErr = new Error(
            `claude CLI timed out after ${TIMEOUT_MS}ms`
          ) as Error & { code?: string; killed?: boolean };
          timeoutErr.code = 'ETIMEDOUT';
          timeoutErr.killed = true;
          settleReject(timeoutErr);
        } else {
          const stderr = Buffer.concat(stderrChunks).toString();
          settleReject(new Error(stderr || `claude exited with code ${code}`));
        }
      });

      // Attach the stdin error handler BEFORE writing. `child.on('error')`
      // above only covers spawn failures on the ChildProcess itself, not
      // write failures on the stdin pipe -- an EPIPE / ERR_STREAM_DESTROYED
      // emitted on a stream with no 'error' listener escalates to an
      // uncaught exception in Node, which takes down the whole Vite server
      // (the app's production runtime), not just this one request.
      child.stdin.on('error', (err: Error) => {
        settleReject(new Error(`Failed to write prompt to claude CLI stdin: ${err.message}`));
      });

      // A stdin pipe that's already destroyed (child died before we got
      // here) must not be written to.
      if (!child.stdin.destroyed) {
        try {
          child.stdin.write(request.prompt);
          child.stdin.end();
        } catch (err) {
          settleReject(err instanceof Error ? err : new Error(String(err)));
        }
      }
    });
  }
}

/**
 * Builds CLI argument array from the request, excluding the prompt itself
 * (which is handled separately based on size).
 */
function buildCliArgs(request: CliRequest): string[] {
  const args = ['--print'];

  if (request.model) {
    args.push('--model', request.model);
  }

  if (request.outputFormat === 'json') {
    args.push('--output-format', 'json');
  }

  if (request.systemPrompt) {
    args.push('--system-prompt', request.systemPrompt);
  }

  if (request.maxTurns !== undefined) {
    args.push('--max-turns', String(request.maxTurns));
  }

  return args;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads the full request body from an HTTP request stream.
 */
const MAX_REQUEST_BODY = 4 * 1024 * 1024; // 4MB — well above any legitimate prompt

function readBody(req: {
  on: (event: string, cb: (data?: Buffer) => void) => void;
  destroy?: () => void;
  pause?: () => void;
  unpipe?: () => void;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    req.on('data', (chunk: Buffer) => {
      if (settled) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_REQUEST_BODY) {
        settled = true;
        // Stop the client from continuing to stream into a socket whose
        // response is about to be written.
        if (typeof req.destroy === 'function') {
          req.destroy();
        } else if (typeof req.pause === 'function') {
          req.pause();
          req.unpipe?.();
        }
        const err = new Error('Request body too large (max 4MB)') as Error & { status?: number };
        err.status = 413;
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString());
    });
    req.on('error', () => {
      if (settled) return;
      settled = true;
      reject(new Error('Failed to read request body'));
    });
  });
}

/**
 * Formats CLI errors into user-friendly messages based on known error codes.
 */
function formatErrorMessage(error: Error, code?: string): string {
  if (code === 'ENOENT') {
    return `Claude CLI not found at '${CLAUDE_CLI_PATH}'. Install Claude Code or set CLAUDE_CLI_PATH in your .env file.`;
  }
  if (code === 'ETIMEDOUT' || error.message.includes('timeout')) {
    return 'AI request timed out after 120 seconds. Try simplifying your prompt or using a faster model.';
  }
  if (error.message.includes('SIGKILL') || error.message.includes('SIGTERM')) {
    return 'AI process terminated unexpectedly. This may indicate insufficient memory.';
  }
  return error.message || 'CLI invocation failed';
}
