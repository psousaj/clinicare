import { describe, expect, it } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Hono } from 'hono';
import { createSpaFallback, createWebAssetMiddleware } from './static-files';

describe('production static serving', () => {
  it('serves assets, falls back to the SPA, and leaves API paths alone', async () => {
    const root = await mkdtemp('/tmp/clinicare-static-');
    try {
      await mkdir(join(root, 'assets'));
      await writeFile(join(root, 'index.html'), '<!doctype html><html>spa-shell</html>');
      await writeFile(join(root, 'assets', 'app.js'), 'window.app = true;');

      const app = new Hono();
      app.get('/api/health', (c) => c.json({ status: 'ok' }));
      app.use('/*', createWebAssetMiddleware(root));
      app.get('*', createSpaFallback(join(root, 'index.html')));

      const page = await app.request('/pacientes/demo');
      expect(page.status).toBe(200);
      expect(page.headers.get('content-type')).toContain('text/html');
      expect(await page.text()).toContain('spa-shell');

      const asset = await app.request('/assets/app.js');
      expect(asset.status).toBe(200);
      expect(await asset.text()).toContain('window.app');

      const api = await app.request('/api/health');
      expect(api.status).toBe(200);
      expect(await api.json()).toEqual({ status: 'ok' });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
