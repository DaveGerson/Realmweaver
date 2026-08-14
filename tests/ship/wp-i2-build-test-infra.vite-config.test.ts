/**
 * wp-i2-build-test-infra — findings #86, #85
 *
 * #86 vite.config.ts `define` maps `process.env.API_KEY` and
 *     `process.env.GEMINI_API_KEY` to `JSON.stringify(env.GEMINI_API_KEY)`, where
 *     `env` comes from `loadEnv(mode, '.', '')` — an empty prefix, so it picks up
 *     BOTH `.env.local` and every key already in `process.env`. Nothing in the app
 *     reads those tokens (the Gemini key is sourced per-campaign from
 *     `campaign.gcpApiKey`), so this is dead config that silently turns any future
 *     `process.env.GEMINI_API_KEY` reference into a literal secret baked into
 *     `dist/assets/index-*.js`. The entries must be deleted.
 *
 * #85 vite.config.ts sets `strictPort: false`, so a taken port 4200 makes Vite
 *     silently move to 4201 while playwright.config.ts's `webServer.url` /
 *     `baseURL` still point at 4200 (and at `localhost`, not the `127.0.0.1` Vite
 *     actually binds to). The port conflict must fail loudly instead.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import viteConfig from '../../vite.config';

const GEMINI_SENTINEL = 'gemini-secret-must-not-reach-the-client-bundle';

const repoFile = (rel: string) => readFileSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)), 'utf8');

async function resolveViteConfig(): Promise<Record<string, any>> {
  // vite.config.ts default-exports the function form of defineConfig.
  const factory = viteConfig as unknown as (env: {
    mode: string;
    command: 'serve' | 'build';
  }) => Record<string, any> | Promise<Record<string, any>>;
  return await factory({ mode: 'production', command: 'build' });
}

describe('wp-i2 — vite.config.ts define block (finding #86)', () => {
  let savedGemini: string | undefined;
  let savedApiKey: string | undefined;

  beforeEach(() => {
    savedGemini = process.env.GEMINI_API_KEY;
    savedApiKey = process.env.API_KEY;
    process.env.GEMINI_API_KEY = GEMINI_SENTINEL;
  });

  afterEach(() => {
    if (savedGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = savedGemini;
    if (savedApiKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = savedApiKey;
  });

  it('does not declare process.env.API_KEY / process.env.GEMINI_API_KEY replacements', async () => {
    const config = await resolveViteConfig();
    const defineKeys = Object.keys(config.define ?? {});

    expect(defineKeys).not.toContain('process.env.API_KEY');
    expect(defineKeys).not.toContain('process.env.GEMINI_API_KEY');

    // Guard rail: only those two entries go — the non-secret provider selectors stay.
    expect(defineKeys).toContain('process.env.REALMWEAVER_AI_PROVIDER');
    expect(defineKeys).toContain('process.env.AI_PROVIDER');
  });

  it('never substitutes a GEMINI_API_KEY value into any client-side define', async () => {
    const config = await resolveViteConfig();

    // Whatever `define` entries survive, none of them may carry the secret —
    // every define value is textually inlined into the shipped bundle.
    expect(JSON.stringify(config.define ?? {})).not.toContain(GEMINI_SENTINEL);
  });

});

describe('wp-i2 — dev server / e2e port binding (finding #85)', () => {
  it('uses strictPort so a taken port 4200 fails loudly instead of drifting to 4201', async () => {
    const config = await resolveViteConfig();

    expect(config.server?.strictPort).toBe(true);
  });

  it('playwright targets the same host Vite binds to (127.0.0.1, not localhost)', () => {
    const playwrightConfig = repoFile('playwright.config.ts');

    // Vite binds 127.0.0.1 by default (vite.config.ts `host`); probing `localhost`
    // resolves to ::1 first under Node's verbatim DNS ordering and never connects.
    expect(playwrightConfig).not.toContain('http://localhost:4200');
    expect(playwrightConfig).toContain('http://127.0.0.1:4200');
  });
});
