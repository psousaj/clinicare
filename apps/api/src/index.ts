import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { connectDatabase } from '@clinicare/db';
import { app } from './app';

const port = Number(process.env.PORT ?? 3000);
await connectDatabase();
app.use('/*', serveStatic({ root: './apps/web/dist', index: 'index.html' }));
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`Clínicare app listening on http://localhost:${info.port}`);
});
