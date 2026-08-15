/**
 * wp-i1-ai-proxy — finding #6 (vite-plugin-ai-proxy.ts:69)
 *
 * `aiProxyPlugin()` registers its routes only inside `configureServer`, which
 * Vite runs for `vite dev` only. `vite preview` uses the separate
 * `configurePreviewServer` hook, so after `npm run build && npm run preview`
 * every POST to /api/ai/generate 404s and every AI feature in the built
 * artifact is dead (ClaudeCliProvider.rawCallApi surfaces "AI request failed
 * with status 404" after withRetry's two attempts).
 *
 * Contract pinned here: the same middleware registration must run for the
 * preview server as for the dev server — /api/ai/health and /api/ai/generate
 * behave identically under both hooks.
 *
 * (A statically hosted dist/ with no node process at all remains out of scope
 * for a unit test — see notes.)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  FakeReq,
  FakeRes,
  mountDevServer,
  mountPreviewServer,
  routeFor,
  waitFor,
} from './wp-i1-ai-proxy.harness';

const h = vi.hoisted(() => {
  const state = { stdout: '{"type":"result","result":"a preview tavern","is_error":false}' };
  const execFile: any = () => {
    throw new Error('callback-style execFile is not used by the proxy');
  };
  execFile[Symbol.for('nodejs.util.promisify.custom')] = async () => ({
    stdout: state.stdout,
    stderr: '',
  });
  const spawn: any = () => {
    throw new Error('spawn should not be reached in these tests');
  };
  return { state, execFile, spawn };
});

vi.mock('child_process', () => ({ execFile: h.execFile, spawn: h.spawn }));

import { aiProxyPlugin } from '../../vite-plugin-ai-proxy';

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AI proxy under `vite preview` — finding #6', () => {
  it('exposes a configurePreviewServer hook', () => {
    const plugin: any = aiProxyPlugin();
    const hook = plugin.configurePreviewServer;
    const fn = typeof hook === 'function' ? hook : hook?.handler;
    expect(typeof fn).toBe('function');
  });

  it('registers the same routes on the preview server as on the dev server', () => {
    const devRoutes = [...mountDevServer(aiProxyPlugin()).keys()].sort();
    const previewRoutes = [...mountPreviewServer(aiProxyPlugin()).keys()].sort();

    expect(previewRoutes).toEqual(devRoutes);
    expect(previewRoutes).toContain('/api/ai/generate');
    expect(previewRoutes).toContain('/api/ai/health');
  });

  it('serves a generate request through the preview server', async () => {
    const handler = routeFor(mountPreviewServer(aiProxyPlugin()), '/api/ai/generate');
    const req = new FakeReq();
    const res = new FakeRes();

    handler(req, res);
    req.sendJson({ prompt: 'Describe a tavern', outputFormat: 'json' });
    await waitFor(() => res.ended);

    expect(res.statusCode).toBe(200);
    expect(res.json().result).toBe('a preview tavern');
  });

  it('serves the health check through the preview server', () => {
    const handler = routeFor(mountPreviewServer(aiProxyPlugin()), '/api/ai/health');
    const req = new FakeReq({ method: 'GET', url: '/api/ai/health' });
    const res = new FakeRes();

    handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });
});
