import path from 'node:path';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_');
  // O .env da raiz (lido pelo turbo) não é enxergado pelo loadEnv acima,
  // que só olha apps/web — carrega ele também para VITE_PORT e proxy.
  const rootEnv = loadEnv(mode, path.resolve(import.meta.dirname, '../..'), 'VITE_');
  const apiTarget = rootEnv.VITE_API_PROXY_TARGET ?? env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000';
  return {
    plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    test: { root: import.meta.dirname, environment: 'jsdom', setupFiles: './src/test-setup.ts', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], exclude: ['../../apps/api/**', '../../packages/**', '**/node_modules/**', '**/dist/**'], testTimeout: 15000 },
    server: {
      port: Number(rootEnv.VITE_PORT ?? env.VITE_PORT ?? 5173),
      proxy: {
        '/api': apiTarget,
        '/public': apiTarget,
      },
    },
  };
});
