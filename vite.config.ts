import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { aiProxyPlugin } from './vite-plugin-ai-proxy';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    // REALMWEAVER_TIMEOUT_MS is also consumed server-side: vite-plugin-ai-proxy.ts
    // reads it live from process.env for the CLI execFile/spawn timeout. loadEnv()
    // only RETURNS .env* values -- it never writes them back into process.env --
    // so bridge this one key here or a .env.local-only setting would silently
    // keep the 120s default. When the key came from the real environment,
    // loadEnv's process.env-wins merge makes this assignment a no-op.
    if (env.REALMWEAVER_TIMEOUT_MS !== undefined) {
      process.env.REALMWEAVER_TIMEOUT_MS = env.REALMWEAVER_TIMEOUT_MS;
    }
    // SECURITY: This dev server IS the production runtime (see CLAUDE.md) and
    // exposes /api/ai/generate, which shells out to the local Claude CLI with
    // client-supplied prompt/model/systemPrompt. Bind to localhost only by
    // default so the endpoint isn't reachable from other devices on the LAN;
    // opt into a wider bind explicitly via REALMWEAVER_DEV_HOST if you know
    // what you're doing (e.g. testing from another device you trust).
    const host = env.REALMWEAVER_DEV_HOST || '127.0.0.1';
    return {
      server: {
        port: 4200,
        host,
        // A taken port must fail loudly rather than silently drifting to 4201 —
        // e2e/playwright.config.ts hardcodes 4200 and would otherwise validate
        // a stale or unrelated server.
        strictPort: true,
      },
      plugins: [
        react(),
        tailwindcss(),
        aiProxyPlugin(),
      ],
      build: {
        rollupOptions: {
          output: {
            // Split out vendor code so the entry chunk isn't a single 900KB+
            // blob users download before first paint.
            //
            // NOTE (wp-i2, finding #90): this vendor split alone does not
            // eliminate the >500KB entry-chunk warning — the bulk of the
            // weight is the app's own component tree (25 dashboards/editors
            // statically imported by ViewRouter.tsx), not vendor code. The
            // per-view components are NOT yet React.lazy-split (only a
            // handful of dialogs and RelationshipGraph/PlotTimeline are);
            // ViewRouter.tsx is owned by wp-e-app-shell, so completing that
            // half of the contract is tracked there, not here. Use an
            // id-based function here (rather than a static package-name map)
            // so the React runtime — which react-dom/scheduler pull in
            // transitively and which other vendor deps like lucide-react
            // otherwise hoist into their own chunk instead — reliably lands
            // in the `react` chunk.
            manualChunks(id) {
              if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
                return 'react';
              }
              if (/node_modules\/lucide-react\//.test(id)) {
                return 'lucide-react';
              }
            },
          },
        },
      },
      define: {
        'process.env.REALMWEAVER_AI_PROVIDER': JSON.stringify(env.REALMWEAVER_AI_PROVIDER || 'claude-cli'),
        'process.env.AI_PROVIDER': JSON.stringify(env.AI_PROVIDER || 'claude-cli'),
        // Client-tunable knobs consumed by services/ai/modelConfig.ts. Each is
        // read through a literal `process.env.<KEY>` token so this substitution
        // works in dev and build alike; keys omitted here (server-only:
        // ANTHROPIC_API_KEY, CLAUDE_CLI_PATH) resolve to undefined client-side.
        'process.env.REALMWEAVER_DEFAULT_TIER': JSON.stringify(env.REALMWEAVER_DEFAULT_TIER || ''),
        'process.env.REALMWEAVER_MAX_RETRIES': JSON.stringify(env.REALMWEAVER_MAX_RETRIES || ''),
        'process.env.REALMWEAVER_TIMEOUT_MS': JSON.stringify(env.REALMWEAVER_TIMEOUT_MS || ''),
        'process.env.REALMWEAVER_API_BASE_URL': JSON.stringify(env.REALMWEAVER_API_BASE_URL || ''),
        // SECURITY: ANTHROPIC_API_KEY is intentionally NOT injected into the client bundle.
        // The claude-cli provider doesn't need it (auth handled by the CLI binary).
        // The future anthropic-api provider will consume it server-side in the Vite middleware.
        //
        // SECURITY: GEMINI_API_KEY / API_KEY are intentionally NOT injected here either.
        // Nothing in the app reads process.env.GEMINI_API_KEY — the Gemini key is sourced
        // per-campaign from campaign.gcpApiKey instead. `loadEnv(mode, '.', '')` uses an
        // empty prefix, so it merges in every key already present in process.env (not just
        // .env* files); wiring it into `define` would silently bake that secret as a literal
        // into dist/assets/*.js the moment any source file referenced the token.
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      test: {
        globals: true,
        environment: 'node',
        exclude: ['e2e/**', 'node_modules/**', 'dist/**', '.claude/**'],
      },
    };
});
