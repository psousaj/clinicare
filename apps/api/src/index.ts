import { connectPostgresDatabase, migrateDatabase, seedDatabase } from '@clinicare/db';
import { app } from './app';
import { seedConfiguredAdministrator } from './admin-commands';
import { createWebAssetMiddleware, serveSpaIndex } from './static-files';

await migrateDatabase();
await seedDatabase(process.env.BOOTSTRAP_CLINIC_NAME?.trim() || undefined);
await seedConfiguredAdministrator();
await connectPostgresDatabase();
app.use('/*', createWebAssetMiddleware());
// Fallback da SPA para rotas do TanStack Router (ex.: /pacientes, /formulario/:token).
app.get('*', serveSpaIndex);

// O export default deixa o Bun trocar o handler a cada mudança no `bun --hot`, sem reiniciar o servidor.
export default { port: Number(process.env.PORT ?? 3000), hostname: '0.0.0.0', fetch: app.fetch };
