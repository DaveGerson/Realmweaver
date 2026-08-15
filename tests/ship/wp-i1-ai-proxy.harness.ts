/**
 * wp-i1-ai-proxy — shared test harness for vite-plugin-ai-proxy.ts
 *
 * NOT a test file (no `.test.` in the name) — it is imported by the
 * wp-i1-ai-proxy.*.test.ts suites.
 *
 * The proxy registers connect-style middleware on a Vite server object, so
 * these helpers fake the two things it touches: the server's `middlewares.use`
 * registry, and the node `IncomingMessage`/`ServerResponse` pair handed to the
 * handler.
 *
 * IMPORTANT FOR THE IMPLEMENTER: every request in these suites is built with
 * `authorizedHeaders()`. If the hardening adds a per-session shared secret
 * header (as finding #30's suggested fix proposes), add it in that ONE helper
 * and all suites keep working.
 */

import { EventEmitter } from 'events';
import { vi } from 'vitest';

export type Middleware = (req: any, res: any, next?: () => void) => void;

/** Headers a legitimate same-origin browser request from the SPA carries. */
export function authorizedHeaders(): Record<string, string> {
  return {
    origin: 'http://localhost:4200',
    host: 'localhost:4200',
    'content-type': 'application/json',
  };
}

export class FakeRes extends EventEmitter {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';
  headersSent = false;
  ended = false;
  endCount = 0;
  writeHeadCount = 0;

  /**
   * Request whose `destroyed` flag this response respects. Mirrors real
   * Node: `IncomingMessage.destroy()` tears down the shared underlying
   * socket, so any subsequent write on the *paired* `ServerResponse` never
   * reaches the client. Link right after constructing both fakes via
   * `res.attach(req)` so a fix that destroys the request before flushing
   * the response fails this fake exactly like it fails a real socket
   * (finding #89).
   */
  private linkedReq: { destroyed: boolean } | null = null;

  attach(req: { destroyed: boolean }) {
    this.linkedReq = req;
    return this;
  }

  private assertSocketAlive() {
    if (this.linkedReq?.destroyed) {
      throw new Error('ECONNRESET: write after underlying request socket was destroyed');
    }
  }

  writeHead(status: number, headers?: Record<string, string>) {
    this.assertSocketAlive();
    this.writeHeadCount += 1;
    if (this.headersSent) {
      // Mirrors node: writing headers twice is a hard error.
      throw new Error('ERR_HTTP_HEADERS_SENT');
    }
    this.statusCode = status;
    if (headers) Object.assign(this.headers, headers);
    this.headersSent = true;
    return this as unknown as any;
  }

  setHeader(key: string, value: string) {
    this.headers[key.toLowerCase()] = value;
  }

  write(chunk: string) {
    this.assertSocketAlive();
    this.body += chunk;
    return true;
  }

  end(chunk?: string) {
    this.assertSocketAlive();
    if (chunk) this.body += chunk;
    this.ended = true;
    this.endCount += 1;
    // Real http.ServerResponse emits 'finish' once the response has been
    // fully flushed to the client -- a correct fix defers any request-side
    // teardown (e.g. req.destroy()) until after this event.
    this.emit('finish');
  }

  json(): any {
    return JSON.parse(this.body || '{}');
  }
}

export class FakeReq extends EventEmitter {
  method: string;
  url: string;
  headers: Record<string, string | undefined>;
  /**
   * Mirrors Node's `IncomingMessage.socket`. Defaults to a loopback peer
   * address so every existing suite (which represents a legitimate
   * same-machine request) keeps passing the TCP-peer-address gate added
   * for finding #30; tests exercising the LAN/forged-header exploit pass
   * an explicit non-loopback `socket.remoteAddress`.
   */
  socket: { remoteAddress?: string };
  destroyed = false;
  paused = false;
  destroy = vi.fn(() => {
    this.destroyed = true;
  });
  pause = vi.fn(() => {
    this.paused = true;
  });
  resume = vi.fn();

  constructor(opts: {
    method?: string;
    url?: string;
    headers?: Record<string, string | undefined>;
    socket?: { remoteAddress?: string };
  } = {}) {
    super();
    this.method = opts.method ?? 'POST';
    this.url = opts.url ?? '/api/ai/generate';
    this.headers = opts.headers ?? authorizedHeaders();
    this.socket = opts.socket ?? { remoteAddress: '127.0.0.1' };
  }

  /** Streams a JSON body and closes the stream. */
  sendJson(payload: unknown) {
    const buf = Buffer.from(JSON.stringify(payload));
    this.emit('data', buf);
    this.emit('end');
  }
}

/**
 * Mounts the plugin's dev-server middleware and returns the route registry.
 */
export function mountDevServer(plugin: any): Map<string, Middleware> {
  return mountHook(plugin, 'configureServer');
}

/**
 * Mounts the plugin's preview-server middleware (finding #6 — this hook does
 * not exist yet).
 */
export function mountPreviewServer(plugin: any): Map<string, Middleware> {
  return mountHook(plugin, 'configurePreviewServer');
}

function mountHook(plugin: any, hookName: string): Map<string, Middleware> {
  const routes = new Map<string, Middleware>();
  const server = {
    middlewares: {
      use(path: string | Middleware, handler?: Middleware) {
        if (typeof path === 'function') {
          routes.set('*', path);
        } else if (handler) {
          routes.set(path, handler);
        }
        return server.middlewares;
      },
    },
    config: {},
    httpServer: null,
  };

  const hook = plugin[hookName];
  const fn = typeof hook === 'function' ? hook : hook?.handler;
  if (typeof fn !== 'function') {
    throw new Error(`plugin has no ${hookName} hook`);
  }
  fn(server as any);
  return routes;
}

export function routeFor(routes: Map<string, Middleware>, path: string): Middleware {
  const handler = routes.get(path);
  if (!handler) {
    throw new Error(
      `no middleware registered for ${path} (registered: ${[...routes.keys()].join(', ') || 'none'})`
    );
  }
  return handler;
}

/** Polls until `predicate()` is true or the budget expires. Never throws. */
export async function waitFor(predicate: () => boolean, timeoutMs = 400): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

/** A fake writable stdin pipe that records whether an error handler existed. */
export class FakeStdin extends EventEmitter {
  destroyed = false;
  writes: string[] = [];
  /** True when an 'error' listener was already attached at write() time. */
  hadErrorListenerAtWrite = false;
  /** Set when an error was emitted with no listener (node → uncaught). */
  unhandledError = false;
  /** When set, write() reports this failure asynchronously (EPIPE). */
  failWith: Error | null = null;

  end = vi.fn();

  write = vi.fn((chunk: any) => {
    this.hadErrorListenerAtWrite = this.listenerCount('error') > 0;
    this.writes.push(String(chunk));
    if (this.failWith) {
      const err = this.failWith;
      setTimeout(() => {
        if (this.listenerCount('error') > 0) {
          this.emit('error', err);
        } else {
          // Node would escalate this to an uncaught exception and take the
          // Vite server (= the app runtime) down.
          this.unhandledError = true;
        }
      }, 0);
    }
    return true;
  });
}

/**
 * Extracts the per-server-session token the plugin injects via
 * `transformIndexHtml` (finding #30's non-forgeable-third-factor mitigation).
 * Real Vite invokes this hook with `(html, ctx)`; tests only care about the
 * returned tag list, so both call shapes (bare array, or `{ html, tags }`)
 * are handled.
 */
export function extractProxyToken(plugin: any): string {
  const hook = plugin.transformIndexHtml;
  const fn = typeof hook === 'function' ? hook : hook?.handler ?? hook?.transform;
  if (typeof fn !== 'function') {
    throw new Error('plugin has no transformIndexHtml hook');
  }
  const result = fn('<html></html>', {} as any);
  const tags = Array.isArray(result) ? result : result?.tags;
  const metaTag = (tags || []).find(
    (t: any) => t?.tag === 'meta' && t?.attrs?.name === 'realmweaver-proxy-token'
  );
  if (!metaTag) {
    throw new Error('proxy token meta tag not found in transformIndexHtml output');
  }
  return metaTag.attrs.content;
}

/** A fake ChildProcess good enough for the spawn() path of invokeClaudeCli. */
export class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  stdin = new FakeStdin();
  killed = false;
  kill = vi.fn((_signal?: string) => {
    this.killed = true;
    return true;
  });
}
