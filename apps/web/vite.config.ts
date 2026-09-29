import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { defineConfig as vitestConfig } from 'vitest/config';

export default vitestConfig({
  plugins: [react()],
  test: { root: __dirname, environment: 'jsdom', setupFiles: './src/test-setup.ts', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'], exclude: ['../../apps/api/**', '../../packages/**', '**/node_modules/**', '**/dist/**'], testTimeout: 10000 },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
