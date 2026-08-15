/**
 * wp-i2-build-test-infra — findings #29, #117, #119
 *
 * #29  index.html ships `https://cdn.tailwindcss.com` (a runtime JIT compiler),
 *      a Google Fonts stylesheet, a jsDelivr stylesheet and a dead
 *      `<script type="importmap">` to production. With those hosts unreachable the
 *      app renders completely unstyled — there is no Tailwind build step and no CSS
 *      file in `dist/assets`. None of the tags carry SRI and there is no CSP, so a
 *      compromise of any of those CDNs is arbitrary script execution in an app that
 *      holds campaign data and `gcpApiKey` in localStorage.
 *
 * #117 `reactflow@11.10.1` is not imported anywhere in the codebase, yet
 *      index.html still loads its jsDelivr stylesheet on every page load and the
 *      importmap still maps `reactflow` and `dagre`.
 *
 * #119 `<link rel="icon" href="/vite.svg">` points at a file that does not exist
 *      (no `public/` directory), so every page load 404s; `<title>` says
 *      "D&D Campaign Weaver" instead of the product name RealmWeaver.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const repoUrl = (rel: string) => new URL(`../../${rel}`, import.meta.url);
const repoPath = (rel: string) => fileURLToPath(repoUrl(rel));
const indexHtml = readFileSync(repoPath('index.html'), 'utf8');

describe('wp-i2 — index.html third-party CDN payload (finding #29)', () => {
  it('does not load Tailwind from cdn.tailwindcss.com', () => {
    // Tailwind must be compiled at build time into a local stylesheet, not
    // JIT-compiled in the browser on every page load.
    expect(indexHtml).not.toContain('cdn.tailwindcss.com');
  });

  it('does not ship a dead importmap pointing at aistudiocdn.com / esm.sh', () => {
    expect(indexHtml).not.toMatch(/<script[^>]*type=["']importmap["']/i);
    expect(indexHtml).not.toContain('aistudiocdn.com');
    expect(indexHtml).not.toContain('esm.sh');
  });

  it('loads no stylesheet from a remote host', () => {
    const remoteStylesheets = [...indexHtml.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)]
      .map((m) => m[0])
      .filter((tag) => /href=["']https?:\/\//i.test(tag));

    expect(remoteStylesheets).toEqual([]);
  });

  it('declares a Content-Security-Policy that does not whitelist remote script hosts', () => {
    // NOTE (wp-i2, test defect fix): the original extraction regex used
    // `content=["']([^"']+)["']` — a *fixed* pair of independent `["']`
    // alternations with no backreference. Since a real CSP value must itself
    // contain single-quoted keyword sources (`'self'`, `'unsafe-inline'`,
    // etc. — required by the CSP spec, not optional styling), the capture
    // group always truncated at the first embedded apostrophe, making this
    // assertion impossible to satisfy for ANY spec-valid policy — including
    // ones the test itself demands contain `'self'` below. Fixed by
    // backreferencing the actual opening quote character so embedded quotes
    // of the same kind used for CSP keywords don't terminate the match early.
    const cspMatch = indexHtml.match(
      /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*content=(["'])((?:(?!\1)[\s\S])*)\1/i
    );

    expect(cspMatch, 'index.html must declare a CSP <meta> tag').not.toBeNull();

    const policy = cspMatch![2];
    expect(policy).toMatch(/script-src[^;]*'self'/);
    // No remote origin may be allowed to execute script in a page that holds
    // campaign data and API keys in localStorage.
    expect(policy).not.toMatch(/script-src[^;]*https?:\/\//);
  });
});

describe('wp-i2 — unused reactflow assets (finding #117)', () => {
  it('does not load the reactflow stylesheet from jsDelivr', () => {
    expect(indexHtml).not.toContain('cdn.jsdelivr.net');
    expect(indexHtml).not.toContain('reactflow');
  });
});

describe('wp-i2 — page identity (finding #119)', () => {
  it('titles the page RealmWeaver', () => {
    const title = indexHtml.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();

    expect(title).toBe('RealmWeaver');
  });

  it('references a favicon that actually exists (or references none at all)', () => {
    const iconTags = [...indexHtml.matchAll(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*>/gi)].map(
      (m) => m[0]
    );

    for (const tag of iconTags) {
      const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
      if (!href || /^(https?:)?\/\/|^data:/i.test(href)) continue;

      const relative = href.replace(/^\//, '');
      const resolvable = existsSync(repoPath(`public/${relative}`)) || existsSync(repoPath(relative));

      expect(resolvable, `favicon href "${href}" does not resolve to a file on disk`).toBe(true);
    }
  });
});
