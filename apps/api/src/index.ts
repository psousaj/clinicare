import { serveStatic } from 'hono/bun';
import { connectPostgresDatabase, migrateDatabase, seedDatabase } from '@clinicare/db';
import { app } from './app';
import { seedConfiguredAdministrator } from './admin-commands';

await migrateDatabase();
await seedDatabase(process.env.BOOTSTRAP_CLINIC_NAME?.trim() || undefined);
await seedConfiguredAdministrator();
await connectPostgresDatabase();
app.use('/*', serveStatic({ root: './apps/web/dist' }));
// Fallback da SPA para rotas do TanStack Router (ex.: /pacientes, /formulario/:token).
app.get('*', async (c, next) => {
  if (c.req.path.startsWith('/api/') || c.req.path.startsWith('/public/')) return next();
  const index = Bun.file('./apps/web/dist/index.html');
  if (!await index.exists()) return c.text('Frontend build not found.', 404);
  return new Response(index, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' } });
});

// O export default deixa o Bun trocar o handler a cada mudança no `bun --hot`, sem reiniciar o servidor.
export default { port: Number(process.env.PORT ?? 3000), hostname: '0.0.0.0', fetch: app.fetch };
