import path from 'node:path';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_');
  return {
    plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    test: { root: import.meta.dirname, environment: 'jsdom', setupFiles: './src/test-setup.ts', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], exclude: ['../../apps/api/**', '../../packages/**', '**/node_modules/**', '**/dist/**'], testTimeout: 15000 },
    server: {
      // process.env vem primeiro: o .env da raiz é repassado pelo turbo
      // (turbo.json `dev.env`); loadEnv só enxerga apps/web/.env.
      port: Number(process.env.VITE_PORT ?? env.VITE_PORT ?? 5173),
      proxy: {
        '/api': process.env.VITE_API_PROXY_TARGET ?? env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
        '/public': process.env.VITE_API_PROXY_TARGET ?? env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
      },
    },
  };
});
