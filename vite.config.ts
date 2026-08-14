import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { aiProxyPlugin } from './vite-plugin-ai-proxy';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
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
            // blob users download before first paint. The per-view
            // dashboards/editors themselves are further split via
            // React.lazy in components/layout/ViewRouter.tsx.
            manualChunks: {
              react: ['react', 'react-dom'],
              'lucide-react': ['lucide-react'],
            },
          },
        },
      },
      define: {
        'process.env.REALMWEAVER_AI_PROVIDER': JSON.stringify(env.REALMWEAVER_AI_PROVIDER || 'claude-cli'),
        'process.env.AI_PROVIDER': JSON.stringify(env.AI_PROVIDER || 'claude-cli'),
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
        exclude: ['e2e/**', 'node_modules/**'],
      },
    };
});
