import { serveStatic } from 'hono/bun';
import { connectPostgresDatabase, migrateDatabase, seedDatabase } from '@clinicare/db';
import { app } from './app';

await migrateDatabase();
await seedDatabase();
await connectPostgresDatabase();
app.use('/*', serveStatic({ root: './apps/web/dist' }));
// Fallback da SPA para rotas do TanStack Router (ex.: /pacientes, /formulario/:token).
app.get('*', (c, next) => (c.req.path.startsWith('/api/') || c.req.path.startsWith('/public/') ? next() : serveStatic({ path: './apps/web/dist/index.html' })(c, next)));

// O export default deixa o Bun trocar o handler a cada mudança no `bun --hot`, sem reiniciar o servidor.
export default { port: Number(process.env.PORT ?? 3000), hostname: '0.0.0.0', fetch: app.fetch };
