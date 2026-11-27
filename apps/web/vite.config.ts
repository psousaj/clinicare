import path from 'node:path';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import { resolveApiProxyTarget, resolveWebPort } from './src/lib/vite-env.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, ['VITE_', 'API_PORT', 'WEB_PORT']);
  // Só carrega da raiz as variáveis Vite e as portas explicitamente necessárias.
  const rootEnv = loadEnv(mode, path.resolve(import.meta.dirname, '../..'), ['VITE_', 'API_PORT', 'WEB_PORT']);
  const webPort = resolveWebPort({ ...env, ...rootEnv });
  const apiTarget = resolveApiProxyTarget(rootEnv, env, webPort);
  return {
    plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    test: { root: import.meta.dirname, environment: 'jsdom', setupFiles: './src/test-setup.ts', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], exclude: ['../../apps/api/**', '../../packages/**', '**/node_modules/**', '**/dist/**'], testTimeout: 30_000 },
    server: {
      port: webPort,
      strictPort: true,
      proxy: {
        '/api': apiTarget,
        '/public': apiTarget,
      },
    },
  };
});
