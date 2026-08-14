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

describe('wp-i2 — vendor chunking (finding #90, verifier round 2)', () => {
  it('declares a manualChunks strategy that isolates react/react-dom/scheduler from other vendor code', async () => {
    const config = await resolveViteConfig();
    const manualChunks = config.build?.rollupOptions?.output?.manualChunks;

    expect(manualChunks, 'vite.config.ts must configure build.rollupOptions.output.manualChunks').toBeDefined();

    // Round-1 used a static `{ react: ['react', 'react-dom'] }` object map, which
    // Rollup resolves by package name only — it does NOT pull in transitive deps
    // like `scheduler` (or force what OTHER vendor chunks — e.g. lucide-react —
    // pre-bundle to `react` internally), so the verifier found the real React
    // runtime hoisted into the lucide-react chunk instead of the react chunk.
    // The fix must be the id-matching function form so every module under
    // node_modules/react*, node_modules/react-dom*, node_modules/scheduler*
    // is routed to the same chunk regardless of which entry point pulled it in.
    expect(typeof manualChunks).toBe('function');

    const reactIds = [
      '/repo/node_modules/react/index.js',
      '/repo/node_modules/react-dom/index.js',
      '/repo/node_modules/scheduler/index.js',
    ];
    for (const id of reactIds) {
      expect(manualChunks(id), `manualChunks(${id}) should route to the react chunk`).toBe('react');
    }
    expect(manualChunks('/repo/node_modules/lucide-react/dist/esm/lucide-react.js')).toBe('lucide-react');
    // Application source must not be swept into a vendor chunk by accident.
    expect(manualChunks('/repo/components/dashboards/NpcDashboard.tsx')).toBeUndefined();
  });

  it('does not claim ViewRouter.tsx is React.lazy-split when it is not (comment accuracy)', () => {
    const source = repoFile('vite.config.ts');
    const viewRouterSource = repoFile('components/layout/ViewRouter.tsx');

    // The comment must not assert, as settled fact, a per-view React.lazy split
    // that hasn't actually landed in ViewRouter.tsx — that misleads the next
    // reader into thinking the >500KB entry-chunk contract is fully satisfied.
    // ViewRouter.tsx is owned by wp-e-app-shell, not wp-i2, so completing the
    // per-view lazy split itself is out of scope here; what's in scope is not
    // shipping a comment that overstates what landed.
    const staticDashboardImports = (
      viewRouterSource.match(/^import \{ \w+ \} from '@\/components\/dashboards\//gm) ?? []
    ).length;
    if (staticDashboardImports > 0) {
      expect(source).not.toMatch(
        /per-view dashboards\/editors themselves are further split via\s*\n?\s*\/\/?\s*React\.lazy/
      );
    }
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
