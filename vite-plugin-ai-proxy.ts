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

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export function aiProxyPlugin(): Plugin {
  return {
    name: 'realmweaver-ai-proxy',
    configureServer(server: ViteDevServer) {

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
                    throw new Error(envelope.result || 'Claude CLI returned an error');
                  }
                  result = envelope.result;
                }
              } catch (parseErr) {
                // If it's not valid JSON envelope, use raw output as-is
                // (this handles the case where --output-format is not json)
                if ((parseErr as Error).message?.includes('Claude CLI returned an error')) {
                  throw parseErr;
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
            const code = (err as { code?: string }).code;
            const isTimeout = error.message.includes('timeout') ||
              error.message.includes('ETIMEDOUT') ||
              code === 'ETIMEDOUT';
            const status = isTimeout ? 504 : 500;

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

      child.stdout.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes <= MAX_BUFFER) {
          stdoutChunks.push(chunk);
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(chunk);
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to start claude subprocess: ${err.message}`));
      });

      child.on('close', (code) => {
        const stdout = Buffer.concat(stdoutChunks).toString();
        if (code === 0) {
          resolve(stdout);
        } else {
          const stderr = Buffer.concat(stderrChunks).toString();
          reject(new Error(stderr || `claude exited with code ${code}`));
        }
      });

      // Write prompt to stdin and close the stream
      child.stdin.write(request.prompt);
      child.stdin.end();
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

function readBody(req: { on: (event: string, cb: (data?: Buffer) => void) => void }): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > MAX_REQUEST_BODY) {
        reject(new Error('Request body too large (max 4MB)'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', () => reject(new Error('Failed to read request body')));
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
