import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import type { MiddlewareHandler } from 'hono';

/** Serve built web assets through Bun.file, avoiding hono/bun's bundled
 * serveStatic adapter (which recurses/returns a Promise under Bun 1.2). */
export function createWebAssetMiddleware(rootPath = './apps/web/dist'): MiddlewareHandler {
  const root = resolve(rootPath);
  return async (c, next) => {
    if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/public/')) return next();

    let pathname: string;
    try {
      pathname = decodeURIComponent(c.req.path);
    } catch {
      return next();
    }
    if (pathname.includes('\0') || pathname.includes('\\')) return next();

    const target = resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(`${root}${sep}`)) return next();

    const targetStat = await stat(target).catch(() => null);
    const filePath = targetStat?.isDirectory() ? resolve(target, 'index.html') : target;
    const fileStat = targetStat?.isDirectory() ? await stat(filePath).catch(() => null) : targetStat;
    if (!fileStat?.isFile()) return next();

    const file = Bun.file(filePath);
    return new Response(file, {
      headers: {
        'content-type': file.type || 'application/octet-stream',
        'cache-control': filePath.endsWith('/index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
      },
    });
  };
}

export function createSpaFallback(indexPath = './apps/web/dist/index.html'): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/public/')) return next();
    const index = Bun.file(indexPath);
    if (!await index.exists()) return c.text('Frontend build not found.', 404);
    return new Response(index, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
  };
}

export const serveSpaIndex = createSpaFallback();
