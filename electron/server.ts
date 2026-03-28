/**
 * electron/server.ts
 *
 * Local HTTP server for the Electron production build.
 * Serves static files from the Vite build output AND handles
 * the /api/ai/* endpoints (ported from vite-plugin-ai-proxy.ts).
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CLAUDE_CLI_PATH = process.env.CLAUDE_CLI_PATH || 'claude';
const TIMEOUT_MS = 120_000;
const MAX_BUFFER = 1024 * 1024;
const DIRECT_PROMPT_LIMIT = 100_000;
const MAX_REQUEST_BODY = 4 * 1024 * 1024;

// ---------------------------------------------------------------------------
// MIME types for static file serving
// ---------------------------------------------------------------------------

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.mjs':  'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
  '.otf':  'font/otf',
  '.map':  'application/json',
};

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

let server: http.Server | null = null;

export function startServer(staticDir: string): Promise<number> {
  return new Promise((resolve, reject) => {
    server = http.createServer(async (req, res) => {
      const url = req.url || '/';

      try {
        // API routes
        if (url === '/api/ai/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', provider: 'claude-cli', cli: CLAUDE_CLI_PATH }));
          return;
        }

        if (url === '/api/ai/generate') {
          if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }
          await handleAiGenerate(req, res);
          return;
        }

        // Static file serving
        serveStatic(staticDir, url, res);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error('[server] Unhandled error:', error.message);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      }
    });

    // Listen on a random available port
    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address();
      if (addr && typeof addr === 'object') {
        console.log(`[server] Listening on http://127.0.0.1:${addr.port}`);
        resolve(addr.port);
      } else {
        reject(new Error('Failed to get server address'));
      }
    });

    server.on('error', reject);
  });
}

export function stopServer() {
  if (server) {
    server.close();
    server = null;
  }
}

// ---------------------------------------------------------------------------
// Static file serving
// ---------------------------------------------------------------------------

function serveStatic(staticDir: string, url: string, res: http.ServerResponse) {
  // Strip query string
  let pathname = url.split('?')[0];

  // Default to index.html for SPA routing
  if (pathname === '/' || !path.extname(pathname)) {
    pathname = '/index.html';
  }

  const filePath = path.join(staticDir, pathname);

  // Prevent path traversal
  if (!filePath.startsWith(staticDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath)) {
    // SPA fallback — serve index.html for client-side routes
    const indexPath = path.join(staticDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

// ---------------------------------------------------------------------------
// AI proxy handler (ported from vite-plugin-ai-proxy.ts)
// ---------------------------------------------------------------------------

interface CliRequest {
  prompt: string;
  model?: string;
  outputFormat?: string;
  systemPrompt?: string;
  maxTurns?: number;
}

async function handleAiGenerate(
  req: http.IncomingMessage,
  res: http.ServerResponse,
) {
  try {
    const body = await readBody(req);
    const request: CliRequest = JSON.parse(body);

    if (!request.prompt) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required field: prompt' }));
      return;
    }

    const startTime = Date.now();
    const rawOutput = await invokeClaudeCli(request);
    const elapsed = Date.now() - startTime;

    // Extract result from Claude CLI JSON envelope
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
      if ((parseErr as Error).message?.includes('Claude CLI returned an error')) {
        throw parseErr;
      }
    }

    console.info(
      `[ai-proxy] ${request.model || 'default'} ${request.outputFormat || 'text'} completed in ${elapsed}ms (${result.length} chars)`,
    );
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ result }));
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const code = (err as { code?: string }).code;
    const isTimeout =
      error.message.includes('timeout') ||
      error.message.includes('ETIMEDOUT') ||
      code === 'ETIMEDOUT';
    const status = isTimeout ? 504 : 500;

    console.error(`[ai-proxy] Error (${status}):`, error.message);

    if (!res.headersSent) {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: formatErrorMessage(error, code),
          code,
        }),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// CLI invocation (same logic as vite-plugin-ai-proxy.ts)
// ---------------------------------------------------------------------------

async function invokeClaudeCli(request: CliRequest): Promise<string> {
  const args = buildCliArgs(request);

  if (request.prompt.length <= DIRECT_PROMPT_LIMIT) {
    args.push('-p', request.prompt);
    const { stdout } = await execFileAsync(CLAUDE_CLI_PATH, args, {
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_BUFFER,
    });
    return stdout;
  } else {
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

      child.stdin.write(request.prompt);
      child.stdin.end();
    });
  }
}

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

function readBody(req: http.IncomingMessage): Promise<string> {
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

function formatErrorMessage(error: Error, code?: string): string {
  if (code === 'ENOENT') {
    return `Claude CLI not found at '${CLAUDE_CLI_PATH}'. Please install Claude Code CLI (https://docs.anthropic.com/en/docs/claude-code) and ensure 'claude' is available on your PATH.`;
  }
  if (code === 'ETIMEDOUT' || error.message.includes('timeout')) {
    return 'AI request timed out after 120 seconds. Try simplifying your prompt or using a faster model.';
  }
  if (error.message.includes('SIGKILL') || error.message.includes('SIGTERM')) {
    return 'AI process terminated unexpectedly. This may indicate insufficient memory.';
  }
  return error.message || 'CLI invocation failed';
}
