import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_');
  return {
    plugins: [react()],
    test: { root: import.meta.dirname, environment: 'jsdom', setupFiles: './src/test-setup.ts', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], exclude: ['../../apps/api/**', '../../packages/**', '**/node_modules/**', '**/dist/**'], testTimeout: 10000 },
    server: {
      port: Number(env.VITE_PORT ?? 5173),
      proxy: {
        '/api': env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
      },
    },
  };
});
