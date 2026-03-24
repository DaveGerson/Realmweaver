import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { aiProxyPlugin } from './vite-plugin-ai-proxy';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
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
