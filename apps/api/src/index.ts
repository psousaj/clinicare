import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { connectDatabase } from '@clinicare/db';
import { app } from './app';

const port = Number(process.env.PORT ?? 3000);
await connectDatabase();
app.use('/*', serveStatic({ root: './apps/web/dist', index: 'index.html' }));
// Fallback da SPA para rotas do TanStack Router (ex.: /pacientes, /formulario/:token).
app.get('*', (c, next) => (c.req.path.startsWith('/api/') || c.req.path.startsWith('/public/') ? next() : serveStatic({ path: './apps/web/dist/index.html' })(c, next)));
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`Clínicare app listening on http://localhost:${info.port}`);
});
