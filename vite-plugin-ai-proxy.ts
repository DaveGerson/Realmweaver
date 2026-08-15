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
 * command injection; prompts exceeding 100KB are piped over stdin to a
 * spawned process (still no shell) to stay clear of ARG_MAX. Either way the
 * prompt travels after a `--` separator so the CLI can never parse it as an
 * option (see invokeClaudeCli).
 *
 * Request authentication (see isLocalRequest below for the full rationale):
 * a TCP-peer-address loopback check (mandatory, unforgeable) layered with an
 * Origin+Host localhost allowlist (blocks DNS-rebinding), plus a per-session
 * PROXY_TOKEN validated when present on the X-Realmweaver-Token header. The
 * token is not yet REQUIRED, and it is injected into the page via
 * transformIndexHtml under `vite dev` only: `apply: 'serve'` keeps `vite
 * build` from baking one build process's token into the static
 * dist/index.html, and `vite preview` serves that prebuilt HTML
 * untransformed, so a previewed page carries NO token meta and authenticates
 * through the peer-address and Origin/Host layers alone. To complete the
 * client rollout: in services/ai/providers/claude-cli.ts (since edited by
 * wp-c), read
 * `document.querySelector('meta[name="realmweaver-proxy-token"]')?.content`
 * once and, when the meta tag exists, echo it as `headers: { ...,
 * 'x-realmweaver-token': token }` on rawCallApi's fetch() call --
 * hasValidToken() already accepts it. Making the token MANDATORY
 * server-side additionally needs a way for a previewed page to learn the
 * live token (e.g. a gated GET /api/ai/token); until then a required token
 * would 403 every AI call under `npm run preview`.
 */

import type { Plugin, ViteDevServer } from 'vite';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { randomBytes, timingSafeEqual } from 'crypto';


const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CLAUDE_CLI_PATH = process.env.CLAUDE_CLI_PATH || 'claude';
const DEFAULT_TIMEOUT_MS = 120_000;
// Floor for a configured REALMWEAVER_TIMEOUT_MS: below ~1s the CLI cannot
// even start, so a sub-second value is a unit mistake, not a real budget.
const MIN_TIMEOUT_MS = 1_000;
const MAX_BUFFER = 1024 * 1024; // 1MB output buffer
const DIRECT_PROMPT_LIMIT = 100_000; // 100KB -- above this, pipe via stdin

/**
 * Request deadline for one CLI invocation, from REALMWEAVER_TIMEOUT_MS
 * (documented in README.md / CLAUDE.md; default 120000). Read live from
 * process.env on every call rather than snapshotted at import time --
 * vite.config.ts bridges a .env.local-only value into process.env when the
 * config factory runs, which is AFTER this module has been imported.
 */
function resolveTimeoutMs(): number {
  const raw = Number.parseInt(process.env.REALMWEAVER_TIMEOUT_MS || '', 10);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.max(raw, MIN_TIMEOUT_MS);
}

// Same-origin allowlist for the local dev/runtime server. Only requests whose
// Origin resolves to localhost/127.0.0.1/[::1] are allowed to invoke the CLI
// -- this blocks DNS-rebinding / cross-origin pages (and other LAN hosts, in
// combination with the `server.host` default in vite.config.ts) from
// silently spending the user's Claude usage.
const ALLOWED_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

// Matches only the hostname portion (no scheme, no port, brackets kept for
// IPv6) of a Host header -- used to detect a request that arrived over a LAN
// bind (REALMWEAVER_DEV_HOST=0.0.0.0 / `vite --host`) even when the Origin
// header has been forged or omitted by a non-browser client. Deliberately
// exact (no unbalanced-bracket forms, no wider 127.0.0.0/8) so it can't be
// satisfied by anything but the two legitimate loopback spellings.
const ALLOWED_HOST_RE = /^(localhost|127\.0\.0\.1|::1|\[::1\])$/i;

/**
 * Strips the `:<port>` suffix from a Host header, bracket-aware. Node/WHATWG
 * URL parsing understands `[::1]:4200` (-> `[::1]`) but rejects a bare,
 * bracket-less `::1` as an invalid URL entirely -- handle that one form
 * directly rather than let a naive `replace(/:\d+$/, '')` mangle it (a bare
 * `::1` ends in `:1`, which a trailing-port strip turns into `:`).
 */
function extractHostname(hostHeader: string): string {
  if (hostHeader === '::1') {
    return '::1';
  }
  try {
    return new URL('http://' + hostHeader + '/').hostname;
  } catch {
    return hostHeader.replace(/:\d+$/, '');
  }
}

// Loopback forms Node reports on `req.socket.remoteAddress` for a
// same-machine TCP connection. Unlike the Origin/Host headers below, this
// value is set by the kernel from the actual TCP peer and cannot be forged
// by the client at the application layer -- not even by a non-browser
// script that freely sets arbitrary headers (curl, python, ...).
function isLoopbackAddress(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  if (remoteAddress === '127.0.0.1' || remoteAddress === '::1') return true;
  // IPv4-mapped IPv6 form Node uses on dual-stack sockets, e.g. ::ffff:127.0.0.1
  if (remoteAddress.startsWith('::ffff:127.')) return true;
  return remoteAddress.startsWith('127.');
}

// Per-server-session secret, generated fresh each time the plugin is
// instantiated (i.e. on every `vite dev`/`vite preview` process start).
// Under `vite dev` it is injected into the served page via
// `transformIndexHtml`; a previewed page never carries one (see the
// transformIndexHtml comment below). Origin and Host
// are both attacker-controlled strings for any non-browser client (curl,
// python, arbitrary scripts) -- reproducibly so even when both are forged to
// read as localhost -- so neither is sufficient authentication on its own.
// A page has to be served BY this process to ever see this value (same-origin
// policy prevents a cross-origin or DNS-rebound page from reading it), which
// makes it the one signal in this file a remote attacker cannot forge.
const PROXY_TOKEN = randomBytes(32).toString('hex');
export const PROXY_TOKEN_HEADER = 'x-realmweaver-token';

/**
 * True only when the supplied header value exactly matches PROXY_TOKEN.
 * Uses a constant-time comparison so response-timing can't be used to guess
 * the token byte-by-byte. NOTE: this is validated when present but not yet
 * required -- see the "Proxy token" comment on isLocalRequest for why, and
 * services/ai/providers/claude-cli.ts for the client-side change that would
 * complete the rollout.
 */
function hasValidToken(headers: Record<string, string | string[] | undefined>): boolean {
  const supplied = headers[PROXY_TOKEN_HEADER];
  if (typeof supplied !== 'string' || !supplied) return false;
  const suppliedBuf = Buffer.from(supplied);
  const expectedBuf = Buffer.from(PROXY_TOKEN);
  if (suppliedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(suppliedBuf, expectedBuf);
}

/**
 * Returns true when a request proves it's a same-origin browser request from
 * the SPA (or, going forward, one carrying the per-session proxy token).
 *
 * Layered checks, most-authoritative first:
 *  1. TCP peer address must be loopback. This is the mandatory,
 *     non-forgeable gate: `req.socket.remoteAddress` reflects the real
 *     connection source and cannot be spoofed by a script that controls
 *     every header it sends, which is exactly the exploit finding #30
 *     reproduced (forging both Origin AND Host from a real LAN peer). A
 *     request that fails this check is rejected outright, regardless of
 *     what its Origin/Host claim.
 *  2. Origin + Host must both resolve to a localhost interface. Origin
 *     cannot be forged by page JS in a browser (fetch/XHR do not let script
 *     override it), so this is what blocks DNS-rebinding / a malicious page
 *     the browser happens to have open; Host cross-checks that the
 *     connection didn't arrive over a LAN bind.
 *
 * PROXY_TOKEN (X-Realmweaver-Token) is deliberately NOT required here yet:
 * the legitimate client (services/ai/providers/claude-cli.ts's rawCallApi)
 * does not send it, and a page served by `vite preview` has no way to learn
 * it at all (see the rollout note in this file's header comment) -- making
 * the token mandatory today would 403 every real AI call. hasValidToken()
 * is exported/used so a token that IS present must still be correct, and so
 * wiring the client header later requires no further server change.
 */
function isLocalRequest(req: {
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
}): boolean {
  if (!isLoopbackAddress(req.socket?.remoteAddress)) {
    return false;
  }

  const headers = req.headers;
  const suppliedToken = headers[PROXY_TOKEN_HEADER];
  // If a token was supplied at all, it must be correct -- a wrong token is
  // always rejected even though a missing one currently falls through to
  // the Origin/Host check (see comment above).
  if (typeof suppliedToken === 'string' && suppliedToken && !hasValidToken(headers)) {
    return false;
  }

  const origin = headers.origin;
  if (typeof origin !== 'string' || !origin || !ALLOWED_ORIGIN_RE.test(origin)) {
    return false;
  }

  const hostHeader = headers.host;
  if (typeof hostHeader !== 'string' || !hostHeader) {
    return false;
  }
  return ALLOWED_HOST_RE.test(extractHostname(hostHeader));
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
  // Health check endpoint. Gated the same way as /api/ai/generate: it can't
  // execute the CLI, but an ungated response (a) confirms to any LAN host
  // that a Realmweaver dev server is listening and (b) previously echoed
  // CLAUDE_CLI_PATH, leaking a filesystem path off-box if the user set it to
  // an absolute path. Neither field is needed by the SPA's own health check.
  server.middlewares.use('/api/ai/health', (req, res) => {
    if (!isLocalRequest(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Origin not allowed' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', provider: 'claude-cli' }));
  });

  // Main AI generation endpoint
  server.middlewares.use('/api/ai/generate', (req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    // Reject any request that doesn't prove it's a same-origin browser
    // request from the SPA (or a same-machine caller carrying the correct
    // proxy token). See isLocalRequest's doc comment for the full
    // three-layer rationale (TCP peer address, Origin+Host, token).
    if (!isLocalRequest(req)) {
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
          // The 413 body-too-large case is the one path where the client
          // may still be actively streaming into `req` when we respond
          // (readBody paused the stream rather than destroying it -- see
          // the comment there for why destroying immediately makes the
          // client see ECONNRESET instead of this 413). Tear the request
          // down once the response is fully flushed (`res.on('finish',
          // ...)`), not immediately -- and register that listener BEFORE
          // calling end(), since 'finish' can fire synchronously.
          if (status === 413 && typeof (res as unknown as { on?: Function }).on === 'function') {
            (res as unknown as { on: (event: string, cb: () => void) => void }).on('finish', () => {
              (req as unknown as { destroy?: () => void }).destroy?.();
            });
          }
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
    // `vite dev` and `vite preview` both resolve plugins with command
    // 'serve', so the route hooks below still run for preview; `vite build`
    // (command 'build') excludes the plugin entirely -- which is the point:
    // transformIndexHtml must never bake one build process's PROXY_TOKEN
    // into the static dist/index.html, where it would shadow the live
    // server's token and (once the client echoes it) 403 every AI call
    // under `npm run preview`.
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      registerAiRoutes(server);
    },
    // `vite dev` runs `configureServer`; `vite preview` (serving the built
    // `dist/`) runs this separate hook instead. Without it every AI call in
    // a previewed/production build 404s -- see finding #6. Neither hook
    // helps a statically-hosted `dist/` served by something other than
    // `vite preview` (e.g. a plain static file host / CDN) -- there is no
    // Node process there at all to run this plugin, so every /api/ai/* call
    // 404s. `npm run dev` (or `npm run preview`) IS the supported runtime;
    // see README.md's "Running the app" section and
    // docs/architecture/system-architecture.md's AI-proxy section for the
    // explicit statement of that deploy story.
    configurePreviewServer(server: MiddlewareServer) {
      registerAiRoutes(server);
    },
    // Injects the per-session proxy token (see PROXY_TOKEN above) into the
    // served page so a legitimate same-origin script -- and only a
    // same-origin script, per the browser's same-origin policy -- can read
    // it back out and echo it on the X-Realmweaver-Token header. With
    // `apply: 'serve'` this only ever runs for dev-served HTML; `vite
    // preview` serves the prebuilt dist/index.html untransformed, so a
    // previewed page has no token meta and relies on the peer-address +
    // Origin/Host layers (the token is optional -- see isLocalRequest).
    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          injectTo: 'head' as const,
          attrs: { name: 'realmweaver-proxy-token', content: PROXY_TOKEN },
        },
      ];
    },
  };
}

// ---------------------------------------------------------------------------
// CLI invocation
// ---------------------------------------------------------------------------

/**
 * Invokes the Claude CLI binary with the given request parameters.
 *
 * For prompts under DIRECT_PROMPT_LIMIT (100KB), the prompt is passed to
 * `execFile` as the positional [prompt] operand after a `--` separator (no
 * shell, safe from injection). The `--` is load-bearing: `-p` is an alias of
 * `--print` (a boolean flag, already emitted by buildCliArgs), NOT a prompt
 * flag, and without the separator the CLI's option parser treats any prompt
 * whose text starts with `-` (bulleted session notes, `---` YAML front
 * matter) as an unknown option and aborts.
 *
 * For larger prompts, the prompt is piped via stdin to avoid ARG_MAX limits.
 * Both paths use execFile/spawn (no shell) to prevent command injection.
 */
async function invokeClaudeCli(request: CliRequest): Promise<string> {
  const args = buildCliArgs(request);
  const timeoutMs = resolveTimeoutMs();

  if (request.prompt.length <= DIRECT_PROMPT_LIMIT) {
    // Direct invocation: no shell, safe from injection
    args.push('--', request.prompt);
    const { stdout } = await execFileAsync(CLAUDE_CLI_PATH, args, {
      timeout: timeoutMs,
      maxBuffer: MAX_BUFFER,
    });
    return stdout;
  } else {
    // Large prompt: pipe via stdin using spawn (no shell, no temp file).
    // A lone `-` already parses as an operand; the `--` is symmetry with the
    // direct path, defending against the CLI ever growing a `-` option.
    return new Promise<string>((resolve, reject) => {
      const child = spawn(CLAUDE_CLI_PATH, [...args, '--', '-'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: timeoutMs,
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
          // default killSignal) once the timeout elapses, leaving `code`
          // null. Mark this distinctly so callers can detect a real timeout
          // instead of a generic non-zero exit.
          const timeoutErr = new Error(
            `claude CLI timed out after ${timeoutMs}ms`
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
      } else {
        // Settle immediately instead of leaving the request hanging on
        // 'close' / child 'error' / the spawn timeout -- a destroyed
        // stdin almost always means the child already died, so the client
        // should get an immediate error rather than wait out the timeout.
        settleReject(new Error('claude CLI stdin closed before the prompt could be written'));
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
        // Stop the client from streaming more data we're going to discard,
        // WITHOUT destroying the socket yet. `IncomingMessage.destroy()`
        // tears down the underlying TCP socket immediately -- since that
        // socket is shared with the paired ServerResponse, any write on the
        // response after destroy() never reaches the client (observed as
        // ECONNRESET, not the 413 this is supposed to deliver). pause() +
        // unpipe() just stop consumption; the caller (the /api/ai/generate
        // handler's .catch) destroys the request only once the 413 has
        // actually been flushed, via the response's 'finish' event.
        if (typeof req.pause === 'function') {
          req.pause();
        }
        req.unpipe?.();
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
 *
 * A non-zero execFile exit rejects with Node's
 * `Command failed: <full argv>\n<stderr>` message -- and the argv embeds the
 * entire --system-prompt (the campaign context) plus the prompt. That
 * multi-KB blob must never be echoed back to the client, so such messages
 * are replaced by the CLI's own stderr tail (the actual error is printed
 * last) before any substring classification runs on them.
 */
const STDERR_TAIL_CHARS = 500;

function formatErrorMessage(error: Error, code?: string): string {
  if (code === 'ENOENT') {
    return `Claude CLI not found at '${CLAUDE_CLI_PATH}'. Install Claude Code or set CLAUDE_CLI_PATH in your .env file.`;
  }
  let message = error.message;
  if (message.startsWith('Command failed:')) {
    const stderr = (error as Error & { stderr?: string | Buffer }).stderr;
    const stderrText = String(stderr ?? '').trim();
    message = stderrText.slice(-STDERR_TAIL_CHARS) || 'Claude CLI exited with an error.';
  }
  if (code === 'ETIMEDOUT' || message.includes('timeout')) {
    return `AI request timed out after ${Math.round(resolveTimeoutMs() / 1000)} seconds. Try simplifying your prompt or using a faster model.`;
  }
  if (message.includes('SIGKILL') || message.includes('SIGTERM')) {
    return 'AI process terminated unexpectedly. This may indicate insufficient memory.';
  }
  return message || 'CLI invocation failed';
}
