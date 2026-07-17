import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
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
        strictPort: false,
      },
      plugins: [
        react(),
        aiProxyPlugin(),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.REALMWEAVER_AI_PROVIDER': JSON.stringify(env.REALMWEAVER_AI_PROVIDER || 'claude-cli'),
        'process.env.AI_PROVIDER': JSON.stringify(env.AI_PROVIDER || 'claude-cli'),
        // SECURITY: ANTHROPIC_API_KEY is intentionally NOT injected into the client bundle.
        // The claude-cli provider doesn't need it (auth handled by the CLI binary).
        // The future anthropic-api provider will consume it server-side in the Vite middleware.
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
